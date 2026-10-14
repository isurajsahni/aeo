/** URL rules for site crawls. Pure, so they're easy to unit-test. */

const TRACKING_PARAM = /^(utm_|gclid$|fbclid$|msclkid$|mc_cid$|mc_eid$|_ga$|ref$|ref_src$)/i;
const NON_PAGE_EXTENSION = /\.(pdf|jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?|zip|rar|gz|tgz|7z|mp4|m4v|mov|avi|webm|mp3|wav|ogg|docx?|xlsx?|pptx?|csv|css|js|mjs|json|xml|rss|atom|txt|woff2?|ttf|otf|eot|exe|dmg|apk)$/i;
// App and account areas that are never useful to audit and can have side effects.
const SKIPPED_PATH = /^\/(wp-admin|wp-login\.php|wp-json|cart|checkout|my-account|account|login|logout|signin|sign-in|signup|register|feed|cdn-cgi)(\/|$)/i;
const SKIPPED_QUERY = /(^|&)(add-to-cart|replytocom|share|print|s)=/i;

const stripWww = (host) => host.replace(/^www\./, '');

/**
 * Canonical form used to de-duplicate URLs: no fragment, no tracking params,
 * lowercase host, no default port, no trailing slash (except the root).
 * Returns null for anything that isn't an http(s) URL.
 */
export function normalizeCrawlUrl(href, base) {
  let url;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.href;
}

/** Should the crawler visit this (already normalized) URL on the site whose host is `siteHost`? */
export function shouldCrawl(href, siteHost) {
  const url = new URL(href);
  if (stripWww(url.hostname) !== stripWww(siteHost)) return false;
  if (NON_PAGE_EXTENSION.test(url.pathname)) return false;
  if (SKIPPED_PATH.test(url.pathname)) return false;
  if (SKIPPED_QUERY.test(url.search.slice(1))) return false;
  return true;
}

/** Path + query, for compact display ("/pricing?plan=pro"). */
export const displayPath = (href) => {
  try {
    const url = new URL(href);
    return `${url.pathname}${url.search}`;
  } catch {
    return href;
  }
};
