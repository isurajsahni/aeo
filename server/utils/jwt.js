import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

const ALGORITHM = 'HS256';

export function signToken(userId) {
  return jwt.sign({}, config.jwt.secret, {
    algorithm: ALGORITHM,
    subject: String(userId),
    expiresIn: config.jwt.expiresIn,
    issuer: config.jwt.issuer,
  });
}

/** Returns the decoded payload, or throws if the token is invalid or expired. */
export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret, {
    algorithms: [ALGORITHM],
    issuer: config.jwt.issuer,
  });
}
