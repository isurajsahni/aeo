/**
 * Local Redis for development without Docker or a system install (dev only).
 *
 *   npm run redis:local     (then, in another terminal: npm run dev)
 */
import { RedisMemoryServer } from 'redis-memory-server';

const port = Number(process.env.LOCAL_REDIS_PORT ?? 6379);
const redis = await RedisMemoryServer.create({ instance: { port } });
console.log(`Local Redis running at redis://${await redis.getHost()}:${await redis.getPort()}`);
console.log('Press Ctrl+C to stop.');

const stop = async () => {
  await redis.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
