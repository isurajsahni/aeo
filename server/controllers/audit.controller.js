import * as auditService from '../services/audit.service.js';

export async function start(req, res) {
  const audit = await auditService.startAudit(req.user.id, req.validated.params.id, req.validated.body);
  res.status(202).json({ audit });
}

export async function listForProject(req, res) {
  const audits = await auditService.listProjectAudits(req.user.id, req.validated.params.id);
  res.json({ audits });
}

export async function get(req, res) {
  const audit = await auditService.getAudit(req.user.id, req.validated.params.id);
  res.json({ audit });
}

export async function status(req, res) {
  const audit = await auditService.getAuditStatus(req.user.id, req.validated.params.id);
  res.json({ audit });
}

export async function pages(req, res) {
  const pageList = await auditService.listAuditPages(req.user.id, req.validated.params.id);
  res.json({ pages: pageList });
}

export async function remove(req, res) {
  await auditService.deleteAudit(req.user.id, req.validated.params.id);
  res.status(204).end();
}
