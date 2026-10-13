import { config } from '../config/index.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/jwt.js';

/**
 * Require a valid session cookie. Loads the user on every request so that
 * deleted accounts lose access immediately. Sets `req.user`.
 */
export async function requireAuth(req, _res, next) {
  const token = req.cookies?.[config.cookie.name];
  if (!token) throw AppError.unauthorized();

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw AppError.unauthorized('Your session has expired. Please log in again.', 'SESSION_EXPIRED');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw AppError.unauthorized();

  req.user = user;
  next();
}

const baseCookieOptions = () => ({
  httpOnly: true,
  secure: config.cookie.secure,
  // `lax` blocks the cookie on cross-site POST/PATCH/DELETE, which together
  // with the strict CORS allowlist protects state-changing routes from CSRF.
  sameSite: 'lax',
  path: '/',
});

export function setAuthCookie(res, token) {
  res.cookie(config.cookie.name, token, { ...baseCookieOptions(), maxAge: config.jwt.maxAgeMs });
}

export function clearAuthCookie(res) {
  res.clearCookie(config.cookie.name, baseCookieOptions());
}
