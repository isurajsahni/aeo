import { config } from '../config/index.js';

/**
 * Who may create an account.
 *  - open=false                -> nobody (existing users can still log in)
 *  - allowlist non-empty       -> only listed emails or "@domain" entries
 *  - otherwise                 -> anyone
 */
export function isRegistrationAllowed(email, { open, allowlist } = config.registration) {
  if (!open) return false;
  if (!allowlist.length) return true;
  const normalized = email.trim().toLowerCase();
  const domain = normalized.slice(normalized.lastIndexOf('@'));
  return allowlist.includes(normalized) || allowlist.includes(domain);
}

/** What the sign-up page needs to know (without revealing the allowlist itself). */
export const registrationStatus = () => ({
  registrationOpen: config.registration.open,
  restricted: config.registration.open && config.registration.allowlist.length > 0,
});
