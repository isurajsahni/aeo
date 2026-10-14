import { config } from '../config/index.js';
import { runAudit } from '../audit/runAudit.js';
import { Audit } from '../models/Audit.js';
import { VisibilityRun } from '../models/VisibilityRun.js';
import { runVisibility } from '../visibility/runVisibility.js';
import { logger } from '../utils/logger.js';

/**
 * Where background work (audits, AI visibility runs) runs. Two drivers behind one interface:
 *  - bullmq: jobs in Redis, processed by a BullMQ worker (in this process or `npm run worker`).
 *    Survives restarts and scales to several workers.
 *  - inline: an in-process queue with a concurrency limit. No Redis needed; audits in
 *    flight are lost on restart.
 * QUEUE_DRIVER=auto (the default) picks bullmq when Redis answers, inline otherwise.
 */
let driver = 'inline';
let queueModule = null;

export const activeDriver = () => driver;

export async function initAuditRunner({ startWorker = config.queue.runWorker } = {}) {
  if (config.queue.driver !== 'inline') {
    try {
      const { probeRedis } = await import('../queues/connection.js');
      await probeRedis();
      queueModule = await import('../queues/audit.queue.js');
      queueModule.getAuditQueue();
      if (startWorker) queueModule.startAuditWorker();
      driver = 'bullmq';
    } catch (err) {
      if (config.queue.driver === 'bullmq') throw new Error(`QUEUE_DRIVER=bullmq but Redis is unavailable: ${err.message}`);
      logger.warn({ reason: err.message }, 'Redis unavailable: running audits in-process (QUEUE_DRIVER=auto). Start Redis for a durable queue.');
    }
  }
  logger.info({ driver }, 'Audit runner ready');
  return driver;
}

// ---------- inline driver ----------
const waiting = [];
let active = 0;

const HANDLERS = { audit: runAudit, visibility: runVisibility };

function drainInline() {
  while (active < config.crawler.maxConcurrentAudits && waiting.length) {
    const { kind, id } = waiting.shift();
    active += 1;
    HANDLERS[kind](id)
      .catch((err) => logger.error({ err, kind, id }, 'Background job error'))
      .finally(() => {
        active -= 1;
        drainInline();
      });
  }
}

// ---------- public API ----------
export async function enqueueAudit(auditId) {
  if (driver === 'bullmq') {
    await queueModule.addAuditJob(auditId);
    return;
  }
  waiting.push({ kind: 'audit', id: String(auditId) });
  setImmediate(drainInline);
}

export async function enqueueVisibilityRun(runId) {
  if (driver === 'bullmq') {
    await queueModule.addVisibilityJob(runId);
    return;
  }
  waiting.push({ kind: 'visibility', id: String(runId) });
  setImmediate(drainInline);
}

const interrupted = {
  status: 'failed',
  error: { message: 'The audit was interrupted by a server restart. Please run it again.', code: 'INTERRUPTED' },
  progress: { stage: 'failed', message: 'Interrupted', percent: 100 },
};

/**
 * On boot: audits stuck "queued"/"running" with no live job can never finish, so fail them.
 * With BullMQ, audits whose job still exists are left alone; the worker will pick them up.
 */
async function recover(Model, getState, label) {
  const inFlight = await Model.find({ status: { $in: ['queued', 'running'] } }).select('_id');
  const orphaned = [];
  for (const { _id } of inFlight) {
    const state = driver === 'bullmq' ? await getState(_id) : null;
    if (!state || state === 'completed' || state === 'failed') orphaned.push(_id);
  }
  if (orphaned.length) {
    await Model.updateMany({ _id: { $in: orphaned } }, interrupted);
    logger.warn({ count: orphaned.length }, `Marked interrupted ${label} as failed`);
  }
}

export async function recoverInterruptedAudits() {
  await recover(Audit, (id) => queueModule.getAuditJobState(id), 'audits');
  await recover(VisibilityRun, (id) => queueModule.getVisibilityJobState(id), 'visibility runs');
}

export async function closeAuditRunner() {
  if (queueModule) await queueModule.closeAuditQueue();
}
