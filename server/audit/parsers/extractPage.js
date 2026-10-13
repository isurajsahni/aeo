import * as cheerio from 'cheerio';
import { extractJsonLd } from './jsonld.js';

const NOISE_SELECTOR = 'script, style, noscript, template, svg, iframe, canvas, object';
const CHROME_SELECTOR =
  'nav, header, footer, aside, form, [role="navigation"], [role="banner"], [role="contentinfo"], [aria-hidden="true"], .cookie, #cookie-banner';
const BLOCK_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, ul, ol, table, dl, blockquote, pre';
const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const SOCIAL_HOSTS = /(^|\.)(facebook|fb|instagram|twitter|x|linkedin|youtube|tiktok|pinterest|threads|wa)\.(com|me|net)$/i;

const clean = (text) => (text ?? '').replace(/\s+/g, ' ').trim();
const countWords = (text) => (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
const stripWww = (host) => host.replace(/^www\./, '');

function metaContent($, predicate) {
  const el = $('meta')
    .filter((_, node) => predicate($(node)))
    .first();
  return el.length ? clean(el.attr('content')) : null;
}

const byName = (name) => (el) => (el.attr('name') ?? '').toLowerCase() === name;
const byProperty = (prop) => (el) => (el.attr('property') ?? el.attr('name') ?? '').toLowerCase() === prop;

/**
 * Pick the element that holds the main content. Prefer semantic <main>/<article>;
 * fall back to <body> with site chrome (nav, header, footer...) removed.
 */
function mainRoot($) {
  const candidate = $('main, [role="main"]').first();
  if (candidate.length && countWords(clean(candidate.text())) >= 50) return candidate;
  const article = $('article').first();
  if (article.length && countWords(clean(article.text())) >= 50) return article;
  const body = $('body').first().clone();
  body.find(CHROME_SELECTOR).remove();
  return body;
}

/** Split main content into heading-led sections (each heading + the blocks that follow it). */
function extractSections($, root) {
  const blocks = root
    .find(BLOCK_SELECTOR)
    .toArray()
    // Skip blocks nested inside other blocks (e.g. <p> inside <li>) to avoid double counting.
    .filter((el) => $(el).parents('p, ul, ol, table, dl, blockquote, pre').length === 0);

  const sections = [];
  let current = null;
  for (const el of blocks) {
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      current = { level: Number(tag[1]), heading: clean($(el).text()), blocks: [] };
      sections.push(current);
    } else if (current) {
      const text = clean($(el).text());
      if (text) current.blocks.push({ tag, text, words: countWords(text) });
    }
  }
  return sections;
}

function extractLinks($, baseUrl) {
  const base = new URL(baseUrl);
  const siteHost = stripWww(base.hostname);
  const mainLinks = new Set(mainRoot($).find('a[href]').toArray().map((el) => $(el).attr('href')));
  const links = [];

  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') ?? '').trim();
    if (!href || href.startsWith('#') || /^javascript:/i.test(href)) return;
    let url;
    try {
      url = new URL(href, base);
    } catch {
      return;
    }
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    const host = stripWww(url.hostname);
    links.push({
      href: url.href,
      text: clean($(el).text()) || clean($(el).attr('aria-label')) || clean($(el).attr('title')),
      rel: ($(el).attr('rel') ?? '').toLowerCase(),
      protocol: url.protocol,
      internal: isHttp && (host === siteHost || host.endsWith(`.${siteHost}`)),
      external: isHttp && !(host === siteHost || host.endsWith(`.${siteHost}`)),
      social: isHttp && SOCIAL_HOSTS.test(host),
      host,
      path: url.pathname.toLowerCase(),
      inMain: mainLinks.has($(el).attr('href')),
    });
  });
  return links;
}

function extractDates($) {
  const dates = [];
  const push = (source, value) => {
    if (!value) return;
    const time = Date.parse(value);
    if (Number.isFinite(time)) dates.push({ source, value, time });
  };
  push('meta article:modified_time', metaContent($, byProperty('article:modified_time')));
  push('meta article:published_time', metaContent($, byProperty('article:published_time')));
  push('meta og:updated_time', metaContent($, byProperty('og:updated_time')));
  $('[itemprop="dateModified"], [itemprop="datePublished"]').each((_, el) => {
    push(`itemprop ${$(el).attr('itemprop')}`, $(el).attr('content') ?? $(el).attr('datetime') ?? $(el).text());
  });
  $('time[datetime]')
    .slice(0, 10)
    .each((_, el) => push('<time> element', $(el).attr('datetime')));
  return dates;
}

function extractAuthorSignals($, mainText) {
  const signals = [];
  const metaAuthor = metaContent($, byName('author'));
  if (metaAuthor) signals.push({ source: 'meta author', value: metaAuthor });
  $('a[rel~="author"], [rel="author"]').each((_, el) => signals.push({ source: 'rel=author link', value: clean($(el).text()) }));
  $('[itemprop="author"]').each((_, el) => signals.push({ source: 'itemprop=author', value: clean($(el).text()).slice(0, 80) }));
  $('[class*="author" i], [class*="byline" i]')
    .slice(0, 5)
    .each((_, el) => {
      const text = clean($(el).text());
      if (text && text.length < 200) signals.push({ source: `.${($(el).attr('class') ?? '').split(/\s+/)[0]}`, value: text.slice(0, 80) });
    });
  const byline = /\b(?:by|written by|author:)\s+([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){0,2})/u.exec(mainText.slice(0, 600));
  if (byline) signals.push({ source: 'byline text', value: byline[1] });
  return signals;
}

/**
 * Parse raw HTML into everything the checks need. Pure: no network access.
 */
export function extractPage(html, baseUrl) {
  const $ = cheerio.load(html ?? '');
  const jsonLd = extractJsonLd($);
  const scriptSrcs = $('script[src]')
    .toArray()
    .map((el) => el.attribs.src);

  $(NOISE_SELECTOR).remove();
  // cheerio's .text() concatenates sibling elements ("<h2>FAQ</h2><p>Hi</p>" -> "FAQHi").
  // Add a separator after every element so words from adjacent blocks never merge.
  $('br').replaceWith(' ');
  $('body *').each((_, el) => {
    if (!VOID_ELEMENTS.has(el.tagName)) $(el).append(' ');
  });

  const root = mainRoot($);
  const mainText = clean(root.text());
  // Prose only (paragraphs and list items), each block ending a sentence. Used for readability,
  // where headings and card labels without punctuation would otherwise merge into huge "sentences".
  const proseText = root
    .find('p, li')
    .toArray()
    .filter((el) => $(el).parents('p, li').length === 0)
    .map((el) => clean($(el).text()))
    .filter((text) => countWords(text) >= 3)
    .map((text) => (/[.!?:;]$/.test(text) ? text : `${text}.`))
    .join(' ');
  const headings = $('h1, h2, h3, h4, h5, h6')
    .toArray()
    .map((el) => ({ level: Number(el.tagName[1]), text: clean($(el).text()) }));

  const og = {};
  $('meta').each((_, el) => {
    const key = ($(el).attr('property') ?? $(el).attr('name') ?? '').toLowerCase();
    if (key.startsWith('og:') || key.startsWith('twitter:')) og[key] ??= clean($(el).attr('content'));
  });

  const canonicals = $('link')
    .filter((_, el) => ($(el).attr('rel') ?? '').toLowerCase().split(/\s+/).includes('canonical'))
    .toArray()
    .map((el) => $(el).attr('href')?.trim())
    .filter(Boolean);

  const robotsMeta = $('meta')
    .filter((_, el) => ['robots', 'googlebot', 'bingbot'].includes(($(el).attr('name') ?? '').toLowerCase()))
    .toArray()
    .map((el) => ({ name: $(el).attr('name').toLowerCase(), content: clean($(el).attr('content')).toLowerCase() }));

  const lists = root
    .find('ul, ol')
    .toArray()
    .filter((el) => $(el).children('li').length >= 2).length;
  const tables = root
    .find('table')
    .toArray()
    .filter((el) => $(el).find('tr').length >= 2).length;

  return {
    title: clean($('title').first().text()) || null,
    titleCount: $('title').length,
    metaDescription: metaContent($, byName('description')),
    canonicals,
    robotsMeta,
    lang: $('html').attr('lang')?.trim() || null,
    hasViewport: $('meta').filter((_, el) => ($(el).attr('name') ?? '').toLowerCase() === 'viewport').length > 0,
    og,
    headings,
    sections: extractSections($, root),
    mainText,
    proseText,
    wordCount: countWords(mainText),
    lists,
    tables,
    detailsElements: root.find('details > summary').length,
    links: extractLinks($, baseUrl),
    dates: extractDates($),
    authorSignals: extractAuthorSignals($, mainText),
    hasArticleElement: $('article').length > 0,
    hasMicrodata: $('[itemscope]').length > 0,
    noSnippetElements: $('[data-nosnippet]').length,
    scriptSrcs,
    jsonLd,
  };
}
