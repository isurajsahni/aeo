// A public hostname: dot-separated labels (1-63 chars, no leading/trailing hyphen)
// ending in an alphabetic or punycode TLD. Raw IPv4/IPv6 addresses never match.
const HOSTNAME_RE =
  /^(?=.{1,253}$)(?:(?!-)[a-z0-9-]{1,63}(?<!-)\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

// Suffixes that only resolve on private networks.
const PRIVATE_SUFFIXES = ['localhost', 'local', 'localdomain', 'internal', 'intranet', 'lan', 'home.arpa', 'corp', 'test', 'invalid'];

/**
 * Normalize user input such as "https://WWW.Example.com/pricing?x=1" to a bare
 * hostname ("www.example.com"). Returns null when the input is not a public domain.
 *
 * This is a validation-time guard for good UX. The crawler performs its own
 * DNS-level SSRF checks before every request (Phase 2).
 */
export function normalizeDomain(input) {
  if (typeof input !== 'string') return null;
  let value = input.trim().toLowerCase();
  if (!value) return null;

  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(value)) value = `https://${value}`;

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;

  // WHATWG URL already converts IDNs to punycode.
  const host = url.hostname.replace(/\.$/, '');
  if (!HOSTNAME_RE.test(host)) return null;
  if (PRIVATE_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) return null;

  return host;
}

export const isValidDomainInput = (input) => normalizeDomain(input) !== null;
