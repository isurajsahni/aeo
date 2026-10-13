/**
 * Create (or reset) a demo user and a demo project.
 * Idempotent: safe to run as many times as you like.
 *
 *   npm run seed
 */
import { config } from '../config/index.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { hashPassword } from '../services/auth.service.js';
import { logger } from '../utils/logger.js';

const demoUser = {
  name: process.env.SEED_USER_NAME || 'Demo Agency',
  email: (process.env.SEED_USER_EMAIL || 'demo@aeoaudit.local').toLowerCase(),
  password: process.env.SEED_USER_PASSWORD || 'DemoPass123',
};

const demoProject = {
  name: 'Example Co (demo client)',
  domain: 'example.com',
  competitors: ['example.org', 'example.net'],
  notes: 'Demo project created by the seed script. Safe to edit or delete.',
};

async function seed() {
  await connectDB(config.mongoUri);
  // Make sure unique indexes exist before upserting.
  await Promise.all([User.syncIndexes(), Project.syncIndexes()]);

  const user = await User.findOneAndUpdate(
    { email: demoUser.email },
    { name: demoUser.name, email: demoUser.email, password: await hashPassword(demoUser.password) },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  await Project.findOneAndUpdate(
    { user: user._id, domain: demoProject.domain },
    { ...demoProject, user: user._id },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );

  logger.info({ email: demoUser.email }, 'Seeded demo user and project (password from SEED_USER_PASSWORD)');
}

seed()
  .catch((err) => {
    logger.error({ err }, 'Seeding failed');
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
