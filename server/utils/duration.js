const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/**
 * Convert a short duration string ("15m", "12h", "7d") to milliseconds.
 * Kept in sync with the format jsonwebtoken accepts for `expiresIn`,
 * so the cookie and the token always expire together.
 */
export function parseDuration(value) {
  const match = /^(\d+)([smhd])$/.exec(String(value).trim());
  if (!match) throw new Error(`Invalid duration "${value}". Use a format like 15m, 12h or 7d.`);
  return Number(match[1]) * UNIT_MS[match[2]];
}
