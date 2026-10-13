import { Audit } from '../models/Audit.js';
import { Page } from '../models/Page.js';
import { Project } from '../models/Project.js';
import { logger } from '../utils/logger.js';
import { gatherContext } from './context.js';
import { runChecks } from './runChecks.js';
import { scoreAudit } from './scoring/index.js';

/**
 * Execute a queued single-page audit end to end and persist the results.
 * Independent of Express so it can run in-process now and inside a BullMQ worker (Phase 3).
 * Never throws: failures are recorded on the audit document.
 */
export async function runAudit(auditId, { gather = gatherContext } = {}) {
  const audit = await Audit.findById(auditId);
  if (!audit || audit.status !== 'queued') return;

  const log = logger.child({ auditId: String(audit._id), url: audit.url });
  const startedAt = new Date();
  await Audit.updateOne({ _id: audit._id }, { status: 'running', startedAt, progress: { stage: 'starting', message: 'Starting audit', percent: 5 } });

  const onProgress = (stage, message, percent) => Audit.updateOne({ _id: audit._id }, { progress: { stage, message, percent } }).exec();

  try {
    const ctx = await gather(audit.url, { onProgress });

    await onProgress('checks', 'Running checks', 85);
    const results = runChecks(ctx);
    const scores = scoreAudit(results, { label: new URL(ctx.finalUrl).hostname.replace(/^www\./, '') });

    await Page.create({
      audit: audit._id,
      project: audit.project,
      url: audit.url,
      finalUrl: ctx.finalUrl,
      statusCode: ctx.response.status,
      title: ctx.page.title,
      wordCount: ctx.page.wordCount,
      schemaTypes: ctx.page.jsonLd.types,
      score: scores.overall,
      grade: scores.grade,
      checks: results,
      fetchMs: ctx.response.durationMs,
    });

    const completedAt = new Date();
    await Audit.updateOne(
      { _id: audit._id },
      {
        status: 'completed',
        finalUrl: ctx.finalUrl,
        checks: results,
        scores: { overall: scores.overall, grade: scores.grade, categories: scores.categories },
        fixes: scores.fixes,
        summary: scores.summary,
        pageCount: 1,
        completedAt,
        durationMs: completedAt - startedAt,
        progress: { stage: 'done', message: 'Audit complete', percent: 100 },
      },
    );
    await Project.updateOne(
      { _id: audit.project },
      { lastAudit: { audit: audit._id, score: scores.overall, grade: scores.grade, completedAt } },
      { timestamps: false },
    );
    log.info({ score: scores.overall, grade: scores.grade, ms: completedAt - startedAt }, 'Audit completed');
  } catch (err) {
    const expected = err.isOperational || err.code;
    if (expected) log.warn({ code: err.code, message: err.message }, 'Audit failed');
    else log.error({ err }, 'Audit crashed');

    const completedAt = new Date();
    await Audit.updateOne(
      { _id: audit._id },
      {
        status: 'failed',
        error: { message: expected ? err.message : 'The audit failed unexpectedly. Please try again.', code: err.code ?? 'AUDIT_FAILED' },
        completedAt,
        durationMs: completedAt - startedAt,
        progress: { stage: 'failed', message: 'Audit failed', percent: 100 },
      },
    ).catch((updateErr) => log.error({ err: updateErr }, 'Could not record audit failure'));
  }
}
