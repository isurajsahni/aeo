import { config } from '../config/index.js';
import { runAudit } from '../audit/runAudit.js';
import { Audit } from '../models/Audit.js';
import { logger } from '../utils/logger.js';

/**
 * Minimal in-process job runner with a concurrency limit (headless Chromium is memory-hungry).
 * Phase 3 swaps this for a BullMQ queue + worker; callers only use enqueueAudit().
 */
const waiting = [];
let active = 0;

function drain() {
  while (active < config.crawler.maxConcurrentAudits && waiting.length) {
    const auditId = waiting.shift();
    active += 1;
    runAudit(auditId)
      .catch((err) => logger.error({ err, auditId }, 'Audit runner error'))
      .finally(() => {
        active -= 1;
        drain();
      });
  }
}

export function enqueueAudit(auditId) {
  waiting.push(String(auditId));
  setImmediate(drain);
}

/** Audits left in flight by a crash or restart can never finish; mark them failed on boot. */
export async function failInterruptedAudits() {
  const { modifiedCount } = await Audit.updateMany(
    { status: { $in: ['queued', 'running'] } },
    {
      status: 'failed',
      error: { message: 'The audit was interrupted by a server restart. Please run it again.', code: 'INTERRUPTED' },
      progress: { stage: 'failed', message: 'Interrupted', percent: 100 },
    },
  );
  if (modifiedCount) logger.warn({ count: modifiedCount }, 'Marked interrupted audits as failed');
}
