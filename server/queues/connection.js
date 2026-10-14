import { Redis } from 'ioredis';
import { config } from '../config/index.js';

/**
 * A Redis connection configured for BullMQ (it requires maxRetriesPerRequest: null).
 * rediss:// URLs (TLS, e.g. Render Key Value or Upstash) work as-is.
 */
export function createRedisConnection(options = {}) {
  return new Redis(config.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true, ...options });
}

/** Resolve if Redis answers PING within `timeoutMs`; otherwise close the probe and reject. */
export async function probeRedis(timeoutMs = 3000) {
  const client = createRedisConnection({ lazyConnect: true, retryStrategy: () => null, connectTimeout: timeoutMs });
  client.on('error', () => {}); // reported through the rejected promise instead
  try {
    await Promise.race([
      client.connect().then(() => client.ping()),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Redis did not answer within ${timeoutMs}ms`)), timeoutMs)),
    ]);
  } finally {
    client.disconnect();
  }
}
