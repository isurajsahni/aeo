import dns from 'node:dns';
import net from 'node:net';
import ipaddr from 'ipaddr.js';

/**
 * SSRF protection for every outbound request the crawler makes.
 *
 * Two layers:
 *  1. assertSafeUrl()  - static checks on the URL (scheme, credentials, port, literal IPs).
 *  2. safeLookup()     - a DNS lookup hook for the HTTP agents. It runs at connect time for
 *                        every request (including each redirect hop) and refuses to connect
 *                        to private/reserved addresses, which also defeats DNS rebinding.
 */

const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443']);

export class BlockedUrlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BlockedUrlError';
    this.code = 'BLOCKED_URL';
  }
}

/** True only for globally routable unicast addresses (no loopback, private, link-local, CGNAT, multicast...). */
export function isPublicIp(address) {
  let parsed;
  try {
    parsed = ipaddr.parse(address);
  } catch {
    return false;
  }
  if (parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress()) parsed = parsed.toIPv4Address();
  return parsed.range() === 'unicast';
}

/** Validate a URL before fetching it. Returns the parsed URL or throws BlockedUrlError. */
export function assertSafeUrl(input) {
  let url;
  try {
    url = input instanceof URL ? input : new URL(input);
  } catch {
    throw new BlockedUrlError(`Invalid URL: ${input}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedUrlError(`Only http and https URLs can be audited (got ${url.protocol})`);
  }
  if (url.username || url.password) throw new BlockedUrlError('URLs with embedded credentials are not allowed');
  if (!ALLOWED_PORTS.has(url.port)) throw new BlockedUrlError(`Port ${url.port} is not allowed`);

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost')) {
    throw new BlockedUrlError('Requests to localhost are not allowed');
  }
  // Literal IPs never go through DNS lookup, so check them here.
  if (net.isIP(host) && !isPublicIp(host)) {
    throw new BlockedUrlError(`Requests to private or reserved addresses are not allowed (${host})`);
  }
  return url;
}

/**
 * Drop-in replacement for dns.lookup used by http(s).Agent. Resolves all addresses and
 * fails if any of them is non-public (a hostname must not be able to point "inside").
 */
export function safeLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const blocked = addresses.find((entry) => !isPublicIp(entry.address));
    if (blocked || !addresses.length) {
      return callback(new BlockedUrlError(`${hostname} resolves to a private or reserved address`));
    }
    if (options.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
}

/** Promise form, used by the headless browser's request interceptor. */
export function assertPublicHost(hostname) {
  return new Promise((resolve, reject) => {
    if (net.isIP(hostname)) {
      return isPublicIp(hostname) ? resolve() : reject(new BlockedUrlError(`Blocked address ${hostname}`));
    }
    safeLookup(hostname, { all: true }, (err) => (err ? reject(err) : resolve()));
  });
}
