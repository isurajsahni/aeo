import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod;

/** Start an isolated in-memory MongoDB for the current test file. */
export async function startTestDB() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Build unique indexes up front so duplicate-key behaviour is tested for real.
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
}

export async function clearTestDB() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

export async function stopTestDB() {
  await mongoose.disconnect();
  await mongod?.stop();
}
