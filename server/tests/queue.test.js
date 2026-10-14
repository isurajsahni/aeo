import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { RedisMemoryServer } from 'redis-memory-server';
import { startTestDB, stopTestDB } from './helpers/db.js';

/**
 * Real BullMQ round trip against a throwaway Redis: enqueue -> worker -> runAudit.
 * runAudit itself is mocked (crawling is covered elsewhere); this tests the plumbing.
 */
const runAudit = jest.fn(async () => {});
jest.unstable_mockModule('../audit/runAudit.js', () => ({ runAudit }));

let redis;
let queueModule;

beforeAll(async () => {
  redis = await RedisMemoryServer.create();
  process.env.REDIS_URL = `redis://${await redis.getHost()}:${await redis.getPort()}`;
  await startTestDB();
  // Import after REDIS_URL is set: config reads it once.
  queueModule = await import('../queues/audit.queue.js');
}, 60_000);

afterAll(async () => {
  await queueModule?.closeAuditQueue();
  await stopTestDB();
  await redis?.stop();
});

test('a queued audit is picked up by the worker exactly once', async () => {
  const auditId = new mongoose.Types.ObjectId().toString();
  queueModule.startAuditWorker();

  await queueModule.addAuditJob(auditId);
  await queueModule.addAuditJob(auditId); // same jobId: ignored

  for (let i = 0; i < 50 && runAudit.mock.calls.length === 0; i += 1) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 300));

  expect(runAudit).toHaveBeenCalledTimes(1);
  expect(runAudit).toHaveBeenCalledWith(auditId);
  expect(await queueModule.getAuditJobState(auditId)).toBe('completed');
});
