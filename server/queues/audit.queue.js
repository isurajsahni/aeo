import { Queue, Worker } from 'bullmq';
import { config } from '../config/index.js';
import { runAudit } from '../audit/runAudit.js';
import { logger } from '../utils/logger.js';
import { createRedisConnection } from './connection.js';

export const AUDIT_QUEUE = 'audits';

let queue = null;
let worker = null;
// BullMQ never closes connections it is handed, so we track and close them ourselves.
const connections = new Set();
const connect = () => {
  const connection = createRedisConnection();
  connections.add(connection);
  return connection;
};

/** The producer side, used by the API to enqueue audits. */
export function getAuditQueue() {
  if (!queue) {
    queue = new Queue(AUDIT_QUEUE, {
      connection: connect(),
      defaultJobOptions: {
        // runAudit records its own failures, so a retry only happens after a crash or stall.
        attempts: 2,
        backoff: { type: 'fixed', delay: 10_000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    });
    queue.on('error', (err) => logger.error({ err }, 'Audit queue error'));
  }
  return queue;
}

/** jobId = auditId, so one audit can never be queued twice. */
export const addAuditJob = (auditId) => getAuditQueue().add('audit', { auditId: String(auditId) }, { jobId: String(auditId) });

/** BullMQ state of an audit's job ('waiting', 'active', 'completed'...), or null if there is none. */
export async function getAuditJobState(auditId) {
  const job = await getAuditQueue().getJob(String(auditId));
  return job ? job.getState() : null;
}

/** The consumer side. Runs in the API process (RUN_WORKER=true) or in `npm run worker`. */
export function startAuditWorker() {
  if (worker) return worker;
  worker = new Worker(AUDIT_QUEUE, (job) => runAudit(job.data.auditId), {
    connection: connect(),
    concurrency: config.crawler.maxConcurrentAudits,
    // Site crawls run for minutes; BullMQ renews the lock while the job is alive.
    lockDuration: 60_000,
  });
  worker.on('failed', (job, err) => logger.error({ err, auditId: job?.data?.auditId }, 'Audit job failed'));
  worker.on('error', (err) => logger.error({ err }, 'Audit worker error'));
  logger.info({ concurrency: config.crawler.maxConcurrentAudits }, 'Audit worker started');
  return worker;
}

export async function closeAuditQueue() {
  await Promise.allSettled([worker?.close(), queue?.close()]);
  await Promise.allSettled([...connections].map((connection) => connection.quit()));
  connections.clear();
  worker = null;
  queue = null;
}
