import { Audit } from '../models/Audit.js';
import { Page } from '../models/Page.js';
import { AppError } from '../utils/AppError.js';
import { enqueueAudit } from './auditRunner.js';
import { getProject } from './project.service.js';

const stripWww = (host) => host.replace(/^www\./, '');

/**
 * Work out which URL to audit. Defaults to the project homepage; a custom URL must
 * belong to the project's domain (or one of its subdomains) so audits stay on the client's site.
 */
export function resolveAuditUrl(domain, input) {
  if (!input) return `https://${domain}/`;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    throw AppError.badRequest('Enter a valid URL', 'VALIDATION_ERROR', [{ path: 'url', message: 'Enter a valid URL' }]);
  }
  const host = stripWww(url.hostname.toLowerCase());
  const projectHost = stripWww(domain);
  if (host !== projectHost && !host.endsWith(`.${projectHost}`)) {
    throw AppError.badRequest(`The URL must be on ${domain}`, 'VALIDATION_ERROR', [{ path: 'url', message: `Use a page on ${domain}` }]);
  }
  url.hash = '';
  return url.href;
}

// History rows include category scores so the client can draw trend lines without loading checks.
const LIST_FIELDS = 'url finalUrl status progress scores crawlConfig pageCount error startedAt completedAt durationMs createdAt';

export async function startAudit(userId, projectId, { url, mode = 'single', maxPages } = {}) {
  const project = await getProject(userId, projectId);
  const target = resolveAuditUrl(project.domain, url);

  const inFlight = await Audit.findOne({ project: project._id, status: { $in: ['queued', 'running'] } }).select('_id');
  if (inFlight) {
    throw new AppError(409, 'An audit is already running for this project', { code: 'AUDIT_IN_PROGRESS', details: [{ path: 'auditId', message: inFlight.id }] });
  }

  const crawlConfig = mode === 'site' ? { mode: 'site', maxPages } : { mode: 'single', maxPages: 1 };
  const audit = await Audit.create({ user: userId, project: project._id, url: target, crawlConfig });
  try {
    await enqueueAudit(audit._id);
  } catch (err) {
    await Audit.updateOne({ _id: audit._id }, { status: 'failed', error: { message: 'The audit queue is unavailable. Please try again shortly.', code: 'QUEUE_UNAVAILABLE' } });
    throw new AppError(503, 'The audit queue is unavailable. Please try again shortly.', { code: 'QUEUE_UNAVAILABLE' });
  }
  return audit;
}

export async function listProjectAudits(userId, projectId, { limit = 50 } = {}) {
  const project = await getProject(userId, projectId);
  return Audit.find({ project: project._id }).select(LIST_FIELDS).sort({ createdAt: -1 }).limit(limit);
}

export async function getAudit(userId, auditId) {
  const audit = await Audit.findOne({ _id: auditId, user: userId });
  if (!audit) throw AppError.notFound('Audit not found');
  return audit;
}

/** Lightweight status read used by polling (no check payloads). */
export async function getAuditStatus(userId, auditId) {
  const audit = await Audit.findOne({ _id: auditId, user: userId }).select('status progress error scores.overall scores.grade pageCount crawlConfig');
  if (!audit) throw AppError.notFound('Audit not found');
  return audit;
}

export async function listAuditPages(userId, auditId) {
  const audit = await Audit.findOne({ _id: auditId, user: userId }).select('_id');
  if (!audit) throw AppError.notFound('Audit not found');
  // Worst pages first; pages that could not be audited (no score) at the end.
  const pages = await Page.find({ audit: audit._id }).select('-checks').sort({ score: 1, url: 1 }).lean({ virtuals: false });
  return pages.map(({ _id, __v, ...page }) => ({ id: String(_id), ...page })).sort((a, b) => (a.score == null) - (b.score == null));
}

/** One page of an audit, with its full check results. */
export async function getAuditPage(userId, auditId, pageId) {
  const audit = await Audit.findOne({ _id: auditId, user: userId }).select('_id');
  if (!audit) throw AppError.notFound('Audit not found');
  const page = await Page.findOne({ _id: pageId, audit: audit._id });
  if (!page) throw AppError.notFound('Page not found');
  return page;
}

export async function deleteAudit(userId, auditId) {
  const audit = await getAudit(userId, auditId);
  if (audit.status === 'queued' || audit.status === 'running') throw AppError.conflict('Wait for the audit to finish before deleting it', 'AUDIT_IN_PROGRESS');
  await Page.deleteMany({ audit: audit._id });
  await audit.deleteOne();
}
