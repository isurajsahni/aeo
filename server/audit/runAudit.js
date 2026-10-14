import { Audit } from '../models/Audit.js';
import { Page } from '../models/Page.js';
import { Project } from '../models/Project.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { aggregateResults } from './aggregate.js';
import { gatherContext } from './context.js';
import { crawlSite } from './crawler/siteCrawler.js';
import { runChecks } from './runChecks.js';
import { scoreAudit } from './scoring/index.js';
import { latestRecentRun } from '../services/visibility.service.js';
import { visibilityChecks } from '../visibility/checks.js';

const siteLabel = (url) => new URL(url).hostname.replace(/^www\./, '');
const issueCounts = (results) => ({
  fail: results.filter((r) => !r.skipped && r.status === 'fail').length,
  warn: results.filter((r) => !r.skipped && r.status === 'warn').length,
});

/** Persist one audited page (or a page that could not be fetched). Duplicate URLs are ignored. */
async function savePage(audit, entry) {
  const doc = entry.error
    ? { url: entry.url, statusCode: entry.statusCode ?? null, depth: entry.depth, error: entry.error }
    : (() => {
        const scores = scoreAudit(entry.results, { label: siteLabel(entry.ctx.finalUrl) });
        return {
          url: entry.url,
          finalUrl: entry.ctx.finalUrl,
          statusCode: entry.ctx.response.status,
          title: entry.ctx.page.title,
          wordCount: entry.ctx.page.wordCount,
          schemaTypes: entry.ctx.page.jsonLd.types,
          depth: entry.depth ?? 0,
          rendered: Boolean(entry.ctx.rendered),
          score: scores.overall,
          grade: scores.grade,
          issues: issueCounts(entry.results),
          checks: entry.results,
          fetchMs: entry.ctx.response.durationMs,
        };
      })();
  try {
    await Page.create({ audit: audit._id, project: audit.project, ...doc });
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }
}

async function auditSinglePage(audit, { gather, onProgress }) {
  const ctx = await gather(audit.url, { onProgress });
  await onProgress('checks', 'Running checks', 85);
  const results = runChecks(ctx);
  await savePage(audit, { url: ctx.finalUrl, depth: 0, ctx, results });
  return { results, finalUrl: ctx.finalUrl, pageCount: 1, crawlStats: null };
}

async function auditSite(audit, { crawl, onProgress }) {
  const pages = [];
  const result = await crawl(audit.url, {
    maxPages: audit.crawlConfig.maxPages,
    onProgress,
    onPage: async (entry) => {
      await savePage(audit, entry);
      if (!entry.error) pages.push({ url: entry.ctx.finalUrl, results: entry.results });
    },
  });
  if (!pages.length) throw new AppError(422, 'No pages on this site could be audited', { code: 'NO_PAGES' });

  await onProgress('checks', `Combining results from ${pages.length} pages`, 90);
  return {
    results: aggregateResults(pages),
    finalUrl: result.site.startPage.url,
    pageCount: pages.length,
    crawlStats: { audited: result.audited, failed: result.failed, discovered: result.discovered, skippedByRobots: result.skippedByRobots },
  };
}

/**
 * Execute a queued audit end to end and persist the results.
 * Independent of Express: called by the BullMQ worker or the in-process runner.
 * Never throws: failures are recorded on the audit document.
 */
export async function runAudit(auditId, { gather = gatherContext, crawl = crawlSite } = {}) {
  const audit = await Audit.findById(auditId);
  if (!audit || !['queued', 'running'].includes(audit.status)) return;

  const log = logger.child({ auditId: String(audit._id), url: audit.url, mode: audit.crawlConfig.mode });
  // A job retried after a worker crash finds the audit "running": start it over cleanly.
  if (audit.status === 'running') await Page.deleteMany({ audit: audit._id });

  const startedAt = new Date();
  await Audit.updateOne({ _id: audit._id }, { status: 'running', startedAt, progress: { stage: 'starting', message: 'Starting audit', percent: 5 } });
  const onProgress = (stage, message, percent) => Audit.updateOne({ _id: audit._id }, { progress: { stage, message, percent } }).exec();

  try {
    const outcome = audit.crawlConfig.mode === 'site' ? await auditSite(audit, { crawl, onProgress }) : await auditSinglePage(audit, { gather, onProgress });

    // Category F comes from the latest recent AI visibility test (skipped when there is none).
    const visibilityRun = await latestRecentRun(audit.project);
    outcome.results.push(...runChecks({ visibility: visibilityRun?.summary ?? null }, { checks: visibilityChecks }));

    const scores = scoreAudit(outcome.results, { label: siteLabel(outcome.finalUrl) });

    const completedAt = new Date();
    await Audit.updateOne(
      { _id: audit._id },
      {
        status: 'completed',
        finalUrl: outcome.finalUrl,
        checks: outcome.results,
        scores: { overall: scores.overall, grade: scores.grade, categories: scores.categories },
        fixes: scores.fixes,
        summary: scores.summary,
        pageCount: outcome.pageCount,
        crawlStats: outcome.crawlStats,
        visibilityRun: visibilityRun?._id ?? null,
        completedAt,
        durationMs: completedAt - startedAt,
        progress: { stage: 'done', message: 'Audit complete', percent: 100 },
      },
    );
    await Project.updateOne({ _id: audit.project }, { lastAudit: { audit: audit._id, score: scores.overall, grade: scores.grade, completedAt } }, { timestamps: false });
    log.info({ score: scores.overall, grade: scores.grade, pages: outcome.pageCount, ms: completedAt - startedAt }, 'Audit completed');
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
