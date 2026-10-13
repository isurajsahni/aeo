import http from 'node:http';
import https from 'node:https';
import axios from 'axios';
import { config } from '../../config/index.js';
import { assertSafeUrl, BlockedUrlError, safeLookup } from '../../utils/ssrf.js';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// Agents with the SSRF-safe DNS hook. Every connection goes through safeLookup.
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 10, lookup: safeLookup });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10, lookup: safeLookup });

const client = axios.create({
  httpAgent,
  httpsAgent,
  proxy: false, // never route through env proxies, which would bypass the lookup hook
  maxRedirects: 0, // redirects are followed manually so each hop is re-validated
  validateStatus: () => true,
  responseType: 'arraybuffer',
  decompress: true,
  transitional: { clarifyTimeoutError: true },
});

export class FetchError extends Error {
  constructor(message, code, cause) {
    super(message);
    this.name = 'FetchError';
    this.code = code;
    this.cause = cause;
  }
}

function toFetchError(err, url) {
  const root = err?.cause ?? err;
  if (err instanceof BlockedUrlError || root instanceof BlockedUrlError || err?.code === 'BLOCKED_URL') {
    return new FetchError(root.message, 'BLOCKED_URL', err);
  }
  if (err?.code === 'ETIMEDOUT' || err?.code === 'ECONNABORTED' || err?.name === 'TimeoutError') {
    return new FetchError(`Timed out fetching ${url}`, 'TIMEOUT', err);
  }
  if (err?.code === 'ERR_BAD_RESPONSE' && /maxContentLength/i.test(err.message)) {
    return new FetchError(`Response from ${url} is larger than the ${Math.round(config.crawler.maxBytes / 1024 / 1024)} MB limit`, 'TOO_LARGE', err);
  }
  if (err?.code === 'ENOTFOUND' || err?.code === 'EAI_AGAIN') return new FetchError(`Could not resolve ${new URL(url).hostname}`, 'DNS_ERROR', err);
  if (err?.code === 'ECONNREFUSED' || err?.code === 'ECONNRESET') return new FetchError(`Connection to ${url} failed`, 'CONNECTION_ERROR', err);
  if (/certificate|SSL|TLS/i.test(err?.message ?? '')) return new FetchError(`TLS/SSL error for ${url}: ${err.message}`, 'TLS_ERROR', err);
  return new FetchError(err?.message ?? `Failed to fetch ${url}`, 'FETCH_ERROR', err);
}

function decodeBody(buffer, contentType = '') {
  const charset = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().replace(/["']/g, '');
  try {
    return new TextDecoder(charset || 'utf-8').decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

/**
 * Fetch a URL with SSRF protection, timeouts, a response size cap and manual
 * redirect handling. Never throws for HTTP error statuses; only for network/policy failures.
 *
 * @returns {{ requestedUrl, url, status, headers, text, redirects, durationMs }}
 */
export async function safeFetch(url, { accept = '*/*', timeoutMs = config.crawler.timeoutMs, maxBytes = config.crawler.maxBytes } = {}) {
  const startedAt = Date.now();
  const redirects = [];
  let current = url;

  for (let hop = 0; ; hop += 1) {
    const target = assertSafeUrl(current);
    let response;
    try {
      response = await client.get(target.href, {
        timeout: timeoutMs,
        signal: AbortSignal.timeout(timeoutMs + 1000),
        maxContentLength: maxBytes,
        headers: {
          'User-Agent': config.crawler.userAgent,
          Accept: accept,
          'Accept-Language': 'en;q=0.9,*;q=0.5',
        },
      });
    } catch (err) {
      throw toFetchError(err, target.href);
    }

    const location = response.headers.location;
    if (REDIRECT_STATUSES.has(response.status) && location) {
      if (hop >= config.crawler.maxRedirects) {
        throw new FetchError(`Too many redirects (more than ${config.crawler.maxRedirects})`, 'TOO_MANY_REDIRECTS');
      }
      const next = new URL(location, target).href;
      redirects.push({ from: target.href, to: next, status: response.status });
      current = next;
      continue;
    }

    const contentType = String(response.headers['content-type'] ?? '');
    return {
      requestedUrl: url,
      url: target.href,
      status: response.status,
      headers: response.headers,
      contentType,
      text: decodeBody(Buffer.from(response.data), contentType),
      redirects,
      durationMs: Date.now() - startedAt,
    };
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polite fetcher: enforces a minimum delay between requests to the same host.
 * One instance per audit, so the delay applies across all of that audit's requests.
 */
export class PoliteFetcher {
  constructor({ delayMs = config.crawler.delayMs, fetchImpl = safeFetch } = {}) {
    this.delayMs = delayMs;
    this.fetchImpl = fetchImpl;
    this.lastRequestAt = new Map();
    this.requestCount = 0;
  }

  setDelay(ms) {
    this.delayMs = Math.max(this.delayMs, ms);
  }

  async fetch(url, options) {
    const host = new URL(url).host;
    const wait = (this.lastRequestAt.get(host) ?? 0) + this.delayMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastRequestAt.set(host, Date.now());
    this.requestCount += 1;
    return this.fetchImpl(url, options);
  }

  /** Like fetch, but returns { error } instead of throwing. Handy for optional resources. */
  async tryFetch(url, options) {
    try {
      return await this.fetch(url, options);
    } catch (error) {
      return { url, status: null, error: { message: error.message, code: error.code ?? 'FETCH_ERROR' } };
    }
  }
}
