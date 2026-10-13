/**
 * Local MongoDB for development without Docker or a system install.
 * Uses the mongod binary from mongodb-memory-server, but persists data to
 * server/storage/mongo so it survives restarts.
 *
 *   npm run db:local     (then, in another terminal: npm run dev)
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../storage/mongo');
const port = Number(process.env.LOCAL_MONGO_PORT ?? 27017);

await mkdir(dbPath, { recursive: true });

const mongod = await MongoMemoryServer.create({
  instance: { port, dbPath, storageEngine: 'wiredTiger', ip: '127.0.0.1' },
});

console.log(`Local MongoDB running at ${mongod.getUri()} (data: ${dbPath})`);
console.log('Press Ctrl+C to stop.');

const stop = async () => {
  // doCleanup: false keeps the data directory on disk.
  await mongod.stop({ doCleanup: false });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
