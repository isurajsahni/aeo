/**
 * Analysis of one AI answer for one project. Pure and deterministic, so it is
 * cheap to run and easy to test; no second model call is needed.
 */

const stripWww = (host) => host.toLowerCase().replace(/^www\./, '');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Words that identify the client: project name, extra brand names, the domain and its first label. */
export function brandTerms({ name = '', domain, brandTerms: extra = [] }) {
  const cleanedName = name.replace(/\([^)]*\)/g, '').trim(); // "Example Co (demo client)" -> "Example Co"
  const host = stripWww(domain);
  const label = host.split('.')[0];
  return unique([cleanedName, ...extra, host, label, label.replace(/-/g, ' ')]);
}

/** Words that identify a competitor from its domain: "rival-dental.com" -> rival-dental.com, rival-dental, rival dental. */
export function competitorTerms(domain) {
  const host = stripWww(domain);
  const label = host.split('.')[0];
  return unique([host, label, label.replace(/-/g, ' ')]);
}

function unique(terms) {
  // Very short terms ("ab") would match everywhere.
  return [...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 3).map((t) => t.toLowerCase()))];
}

/** Index of the first whole-word match of any term, or -1. */
export function findMention(text, terms) {
  if (!text || !terms.length) return -1;
  const sorted = [...terms].sort((a, b) => b.length - a.length).map(escapeRegex);
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${sorted.join('|')})(?=$|[^\\p{L}\\p{N}])`, 'iu');
  const match = re.exec(text);
  return match ? match.index + match[1].length : -1;
}

/** Numbered or bulleted list items, in order (AI "best X" answers are usually lists). */
export function listItems(text) {
  return (text ?? '')
    .split(/\r?\n/)
    .filter((line) => /^\s*(\d{1,2}[.)]|[-*•])\s+\S/.test(line))
    .map((line, i) => ({ rank: i + 1, text: line.trim() }));
}

/** 1-based position of the brand among the answer's list items, or null if it isn't in a list. */
export function mentionRank(text, terms) {
  const item = listItems(text).find((entry) => findMention(entry.text, terms) !== -1);
  return item ? item.rank : null;
}

const POSITIVE = /\b(best|top|excellent|outstanding|highly (rated|recommended)|recommended|trusted|reputable|popular|leading|well[- ]known|great|favou?rite|award[- ]winning|5[- ]star|affordable|friendly|professional|reliable|quality)\b/gi;
const NEGATIVE = /\b(avoid|poor|bad|worst|complaints?|negative reviews?|overpriced|scam|unreliable|rude|issues?|problems?|mixed reviews|not recommended|disappointing|closed permanently)\b/gi;

/** Sentiment of the text around the first brand mention: the sentence it's in and the next one. */
export function sentimentAround(text, index) {
  if (index < 0) return null;
  const start = Math.max(text.lastIndexOf('\n', index), text.lastIndexOf('. ', index), 0);
  const window = text.slice(start, index + 280);
  const positive = window.match(POSITIVE)?.length ?? 0;
  const negative = window.match(NEGATIVE)?.length ?? 0;
  if (negative > positive) return 'negative';
  if (positive > negative) return 'positive';
  return 'neutral';
}

const hostOf = (url) => {
  try {
    return stripWww(new URL(url).hostname);
  } catch {
    return '';
  }
};
const onDomain = (url, domain) => {
  const host = hostOf(url);
  const target = stripWww(domain);
  return host === target || host.endsWith(`.${target}`);
};

/**
 * @param answer  { text, citations: [{ url, title }] }
 * @param targets { brand: { domain, terms }, competitors: [{ domain, terms }] }
 */
export function analyzeAnswer(answer, targets) {
  const text = answer.text ?? '';
  const citations = answer.citations ?? [];
  const index = findMention(text, targets.brand.terms);
  const clientCitations = citations.filter((c) => onDomain(c.url, targets.brand.domain));
  const citationPosition = citations.findIndex((c) => onDomain(c.url, targets.brand.domain));

  const competitorsMentioned = targets.competitors
    .filter((c) => findMention(text, c.terms) !== -1 || citations.some((cit) => onDomain(cit.url, c.domain)))
    .map((c) => c.domain);

  return {
    brandMentioned: index !== -1 || clientCitations.length > 0,
    mentionIndex: index === -1 ? null : index,
    rank: index === -1 ? null : mentionRank(text, targets.brand.terms),
    listLength: listItems(text).length,
    domainCited: clientCitations.length > 0,
    citationPosition: citationPosition === -1 ? null : citationPosition + 1,
    citedUrls: clientCitations.map((c) => c.url),
    sentiment: sentimentAround(text, index),
    competitorsMentioned,
  };
}

/** Targets for a project, computed once per run. */
export const targetsFor = (project) => ({
  brand: { domain: project.domain, terms: brandTerms(project) },
  competitors: (project.competitors ?? []).map((domain) => ({ domain, terms: competitorTerms(domain) })),
});
