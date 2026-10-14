import { config } from '../config/index.js';
import { AiResult } from '../models/AiResult.js';
import { Project } from '../models/Project.js';
import { Prompt } from '../models/Prompt.js';
import { VisibilityRun } from '../models/VisibilityRun.js';
import { getEnabledProviders } from '../providers/index.js';
import { logger } from '../utils/logger.js';
import { runPool } from '../utils/pool.js';
import { analyzeAnswer, targetsFor } from './analyze.js';
import { summarizeRun } from './summarize.js';

const MAX_ANSWER_CHARS = 40_000;

/**
 * Execute a queued visibility run: every prompt x provider x repeat, a few at a time,
 * each answer analyzed and stored, then rolled up into the run summary.
 * Called by the BullMQ worker or the in-process runner. Never throws.
 */
export async function runVisibility(runId, { providers = getEnabledProviders(), concurrency = config.visibility.concurrency } = {}) {
  const run = await VisibilityRun.findById(runId);
  if (!run || !['queued', 'running'].includes(run.status)) return;
  const log = logger.child({ visibilityRunId: String(run._id) });
  if (run.status === 'running') await AiResult.deleteMany({ run: run._id }); // retried after a crash

  const startedAt = new Date();
  try {
    const project = await Project.findById(run.project);
    const prompts = await Prompt.find({ _id: { $in: run.config.promptIds } }).sort({ createdAt: 1 });
    const chosen = providers.filter((p) => run.config.providers.includes(p.id));
    if (!project || !prompts.length) throw Object.assign(new Error('There are no prompts to test.'), { code: 'NO_PROMPTS' });
    if (!chosen.length) throw Object.assign(new Error('None of the selected AI assistants is configured. Add their API keys on the server.'), { code: 'NO_PROVIDERS' });

    // Interleave providers so all of them make progress together.
    const tasks = [];
    for (let iteration = 1; iteration <= run.config.runsPerPrompt; iteration += 1)
      for (const prompt of prompts) for (const provider of chosen) tasks.push({ prompt, provider, iteration });

    await VisibilityRun.updateOne({ _id: run._id }, { status: 'running', startedAt, progress: { done: 0, total: tasks.length, message: 'Asking AI assistants' } });

    const targets = targetsFor(project);
    let done = 0;
    await runPool(tasks, concurrency, async ({ prompt, provider, iteration }) => {
      const t0 = Date.now();
      const base = { run: run._id, project: project._id, prompt: prompt._id, promptText: prompt.text, provider: provider.id, iteration };
      try {
        const answer = await provider.ask({ prompt: prompt.text, location: prompt.location });
        await AiResult.create({
          ...base,
          model: answer.model,
          answer: answer.text.slice(0, MAX_ANSWER_CHARS),
          citations: answer.citations.slice(0, 50),
          analysis: analyzeAnswer(answer, targets),
          latencyMs: Date.now() - t0,
          usage: answer.usage,
        });
      } catch (err) {
        log.warn({ provider: provider.id, err: err.message }, 'AI assistant request failed');
        await AiResult.create({ ...base, model: provider.model, error: { message: err.message.slice(0, 500), code: err.code ?? String(err.status ?? 'PROVIDER_ERROR') }, latencyMs: Date.now() - t0 });
      }
      done += 1;
      await VisibilityRun.updateOne({ _id: run._id }, { 'progress.done': done, 'progress.message': `${provider.label}: "${prompt.text.slice(0, 60)}" (${iteration}/${run.config.runsPerPrompt})` });
    });

    const results = await AiResult.find({ run: run._id }).select('prompt provider analysis error usage').lean();
    const summary = summarizeRun({
      results,
      prompts: prompts.map((p) => ({ id: p._id, text: p.text })),
      providers: chosen.map((p) => p.describe()),
      competitors: project.competitors,
    });
    if (!summary.totals.responses) {
      const firstError = results.find((r) => r.error)?.error?.message ?? 'unknown error';
      throw Object.assign(new Error(`Every request failed. First error: ${firstError}`), { code: 'ALL_FAILED' });
    }

    const usage = results.reduce((acc, r) => ({ inputTokens: acc.inputTokens + (r.usage?.inputTokens ?? 0), outputTokens: acc.outputTokens + (r.usage?.outputTokens ?? 0) }), { inputTokens: 0, outputTokens: 0 });
    const completedAt = new Date();
    await VisibilityRun.updateOne(
      { _id: run._id },
      { status: 'completed', summary, usage, completedAt, durationMs: completedAt - startedAt, progress: { done: tasks.length, total: tasks.length, message: 'Done' } },
    );
    log.info({ mentionRate: summary.totals.mentionRate, answers: summary.totals.responses }, 'Visibility run completed');
  } catch (err) {
    const completedAt = new Date();
    log.warn({ err: err.message }, 'Visibility run failed');
    await VisibilityRun.updateOne(
      { _id: run._id },
      { status: 'failed', error: { message: err.code ? err.message : 'The visibility test failed unexpectedly.', code: err.code ?? 'RUN_FAILED' }, completedAt, durationMs: completedAt - startedAt },
    ).catch(() => {});
  }
}
