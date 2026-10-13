import bcrypt from 'bcrypt';
import { config } from '../config/index.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { isRegistrationAllowed } from './registration.js';

let dummyHashPromise;
/**
 * A hash to compare against when the email doesn't exist, so a failed login
 * takes the same time whether or not the account exists (no user enumeration by timing).
 */
const getDummyHash = () => (dummyHashPromise ??= bcrypt.hash('not-a-real-password', config.bcryptRounds));

export const hashPassword = (password) => bcrypt.hash(password, config.bcryptRounds);

export async function registerUser({ name, email, password }) {
  if (!isRegistrationAllowed(email)) {
    throw new AppError(403, 'Sign-ups are closed. Ask an administrator for an invite.', { code: 'REGISTRATION_CLOSED' });
  }
  if (await User.exists({ email })) {
    throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  }

  try {
    return await User.create({ name, email, password: await hashPassword(password) });
  } catch (err) {
    // Two simultaneous sign-ups with the same email: the unique index wins.
    if (err?.code === 11000) throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
    throw err;
  }
}

export async function authenticateUser({ email, password }) {
  const user = await User.findOne({ email }).select('+password');
  const passwordMatches = await bcrypt.compare(password, user?.password ?? (await getDummyHash()));

  if (!user || !passwordMatches) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  user.lastLoginAt = new Date();
  await user.save();
  return user;
}
