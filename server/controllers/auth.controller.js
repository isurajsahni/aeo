import { clearAuthCookie, setAuthCookie } from '../middleware/auth.js';
import { authenticateUser, registerUser } from '../services/auth.service.js';
import { config } from '../config/index.js';
import { registrationStatus } from '../services/registration.js';
import { signToken } from '../utils/jwt.js';

export async function register(req, res) {
  const user = await registerUser(req.validated.body);
  setAuthCookie(res, signToken(user.id));
  res.status(201).json({ user });
}

export async function login(req, res) {
  const user = await authenticateUser(req.validated.body);
  setAuthCookie(res, signToken(user.id));
  res.json({ user });
}

export function logout(_req, res) {
  clearAuthCookie(res);
  res.status(204).end();
}

export function publicConfig(_req, res) {
  res.json({ ...registrationStatus(), crawl: { defaultPages: config.crawler.defaultCrawlPages, maxPages: config.crawler.maxCrawlPages } });
}

export function me(req, res) {
  res.json({ user: req.user });
}
