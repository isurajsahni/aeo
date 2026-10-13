import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

let closing = false;

export async function connectDB(uri) {
  mongoose.connection.on('disconnected', () => {
    if (!closing) logger.warn('MongoDB disconnected');
  });
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
  return mongoose.connection;
}

export async function disconnectDB() {
  closing = true;
  await mongoose.disconnect();
}

export const isDBConnected = () => mongoose.connection.readyState === 1;
