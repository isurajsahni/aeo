import { config } from '../config/index.js';
import { AiResult } from '../models/AiResult.js';
import { Prompt } from '../models/Prompt.js';
import { VisibilityRun } from '../models/VisibilityRun.js';
import { getEnabledProviders } from '../providers/index.js';
import { AppError } from '../utils/AppError.js';
import { enqueueVisibilityRun } from './auditRunner.js';
import { getProject } from './project.service.js';

// ---------- prompts ----------

export async function listPrompts(userId, projectId) {
  const project = await getProject(userId, projectId);
  return Prompt.find({ project: project._id }).sort({ createdAt: 1 });
}

export async function createPrompt(userId, projectId, data) {
  const project = await getProject(userId, projectId);
  if ((await Prompt.countDocuments({ project: project._id })) >= config.visibility.maxPrompts) {
    throw AppError.badRequest(`A project can have at most ${config.visibility.maxPrompts} prompts`, 'TOO_MANY_PROMPTS');
  }
  return Prompt.create({ ...data, user: userId, project: project._id });
}

async function ownedPrompt(userId, projectId, promptId) {
  const project = await getProject(userId, projectId);
  const prompt = await Prompt.findOne({ _id: promptId, project: project._id });
  if (!prompt) throw AppError.notFound('Prompt not found');
  return prompt;
}

export async function updatePrompt(userId, projectId, promptId, changes) {
  const prompt = await ownedPrompt(userId, projectId, promptId);
  for (const [key, value] of Object.entries(changes)) if (value !== undefined) prompt.set(key, value);
  return prompt.save();
}

/** Past results keep the prompt's text, so deleting a prompt doesn't break run history. */
export async function deletePrompt(userId, projectId, promptId) {
  const prompt = await ownedPrompt(userId, projectId, promptId);
  await prompt.deleteOne();
}

// ---------- runs ----------

export const listProviders = () => getEnabledProviders().map((p) => p.describe());

export async function startRun(userId, projectId, { providers, runsPerPrompt, promptIds }) {
  const project = await getProject(userId, projectId);
  const enabled = listProviders().map((p) => p.id);
  if (!enabled.length) {
    throw new AppError(503, 'No AI assistants are configured. Add OPENAI_API_KEY, ANTHROPIC_API_KEY, PERPLEXITY_API_KEY or GEMINI_API_KEY on the server.', { code: 'NO_PROVIDERS' });
  }
  const chosen = providers ?? enabled;
  const unavailable = chosen.filter((p) => !enabled.includes(p));
  if (unavailable.length) throw AppError.badRequest(`Not configured on this server: ${unavailable.join(', ')}`, 'VALIDATION_ERROR', [{ path: 'providers', message: `Not configured: ${unavailable.join(', ')}` }]);

  const filter = { project: project._id, ...(promptIds ? { _id: { $in: promptIds } } : { active: true }) };
  const prompts = await Prompt.find(filter).select('_id');
  if (!prompts.length) throw AppError.badRequest('Add at least one active prompt first', 'NO_PROMPTS');

  const calls = prompts.length * chosen.length * runsPerPrompt;
  if (calls > config.visibility.maxCallsPerRun) {
    throw AppError.badRequest(`That would make ${calls} AI requests; the limit per test is ${config.visibility.maxCallsPerRun}. Use fewer prompts, assistants or repeats.`, 'TOO_MANY_CALLS');
  }

  const inFlight = await VisibilityRun.findOne({ project: project._id, status: { $in: ['queued', 'running'] } }).select('_id');
  if (inFlight) throw new AppError(409, 'A visibility test is already running for this project', { code: 'RUN_IN_PROGRESS', details: [{ path: 'runId', message: inFlight.id }] });

  const run = await VisibilityRun.create({
    user: userId,
    project: project._id,
    config: { providers: chosen, runsPerPrompt, promptIds: prompts.map((p) => p._id) },
    progress: { done: 0, total: calls, message: 'Waiting to start' },
  });
  try {
    await enqueueVisibilityRun(run._id);
  } catch {
    await VisibilityRun.updateOne({ _id: run._id }, { status: 'failed', error: { message: 'The job queue is unavailable.', code: 'QUEUE_UNAVAILABLE' } });
    throw new AppError(503, 'The job queue is unavailable. Please try again shortly.', { code: 'QUEUE_UNAVAILABLE' });
  }
  return run;
}

export async function listRuns(userId, projectId, { limit = 30 } = {}) {
  const project = await getProject(userId, projectId);
  return VisibilityRun.find({ project: project._id }).select('status config progress summary.totals summary.providers error createdAt completedAt durationMs').sort({ createdAt: -1 }).limit(limit);
}

export async function getRun(userId, runId, fields) {
  const run = await VisibilityRun.findOne({ _id: runId, user: userId }).select(fields);
  if (!run) throw AppError.notFound('Visibility test not found');
  return run;
}

export async function listResults(userId, runId, { prompt, provider } = {}) {
  const run = await getRun(userId, runId, '_id');
  return AiResult.find({ run: run._id, ...(prompt && { prompt }), ...(provider && { provider }) }).sort({ prompt: 1, provider: 1, iteration: 1 }).limit(500);
}

/** Latest completed run for a project, if recent enough to count towards an audit's category F. */
export function latestRecentRun(projectId, now = new Date()) {
  const since = new Date(now.getTime() - config.visibility.maxAgeDays * 86_400_000);
  return VisibilityRun.findOne({ project: projectId, status: 'completed', completedAt: { $gte: since } }).sort({ completedAt: -1 });
}
