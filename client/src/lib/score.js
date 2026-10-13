/** Shared colour language for scores, statuses and grades. */

export function scoreTone(score) {
  if (score == null) return 'neutral';
  if (score >= 80) return 'good';
  if (score >= 60) return 'ok';
  return 'bad';
}

export const TONE_CLASSES = {
  good: { text: 'text-emerald-600', bg: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700 ring-emerald-200', stroke: '#10b981' },
  ok: { text: 'text-amber-600', bg: 'bg-amber-500', soft: 'bg-amber-50 text-amber-700 ring-amber-200', stroke: '#f59e0b' },
  bad: { text: 'text-red-600', bg: 'bg-red-500', soft: 'bg-red-50 text-red-700 ring-red-200', stroke: '#ef4444' },
  neutral: { text: 'text-slate-500', bg: 'bg-slate-300', soft: 'bg-slate-100 text-slate-600 ring-slate-200', stroke: '#cbd5e1' },
};

export const toneFor = (score) => TONE_CLASSES[scoreTone(score)];

export const CATEGORY_ORDER = ['crawlerAccess', 'structuredData', 'content', 'trust', 'technical', 'aiVisibility'];

export const CATEGORY_DESCRIPTIONS = {
  crawlerAccess: 'Can AI crawlers reach and read your pages?',
  structuredData: 'Do machines understand who you are and what pages contain?',
  content: 'Is content shaped so AI can lift answers from it?',
  trust: 'Does the site show expertise and legitimacy?',
  technical: 'Are the technical foundations sound?',
  aiVisibility: 'Do AI assistants mention you today?',
};

export const BUCKET_LABELS = {
  'quick-win': 'Quick win',
  'major-project': 'Major project',
  'fill-in': 'Fill-in',
  deprioritize: 'Low priority',
};

export const isAuditActive = (audit) => audit?.status === 'queued' || audit?.status === 'running';
