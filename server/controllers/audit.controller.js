import * as auditService from '../services/audit.service.js';

const isActive = (audit) => audit.status === 'queued' || audit.status === 'running';
const STREAM_POLL_MS = 1000;
const STREAM_HEARTBEAT_MS = 15_000;
const STREAM_MAX_MS = 15 * 60_000;

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

/**
 * Server-Sent Events: pushes the audit's status/progress until it finishes.
 * Reads progress from MongoDB, so it works whether the worker runs in this
 * process or elsewhere. The browser's EventSource reconnects on its own.
 */
export async function events(req, res) {
  const { id } = req.validated.params;
  const first = await auditService.getAuditStatus(req.user.id, id); // 404s before the stream opens

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering (nginx and friends)
  });

  let closed = false;
  let last = '';
  let timer;
  const startedAt = Date.now();
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), STREAM_HEARTBEAT_MS);
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    clearInterval(heartbeat);
    res.end();
  };
  req.on('close', close);

  const push = (audit) => {
    const json = JSON.stringify(audit);
    if (json !== last) {
      last = json;
      send('progress', audit);
    }
    if (!isActive(audit)) {
      send('done', audit);
      close();
      return false;
    }
    return true;
  };

  const tick = async () => {
    if (closed) return;
    if (Date.now() - startedAt > STREAM_MAX_MS) return close(); // the client reconnects
    try {
      if (push(await auditService.getAuditStatus(req.user.id, id))) timer = setTimeout(tick, STREAM_POLL_MS);
    } catch (err) {
      send('error', { message: err.message });
      close();
    }
  };

  if (push(first.toJSON())) timer = setTimeout(tick, STREAM_POLL_MS);
}

export async function page(req, res) {
  const result = await auditService.getAuditPage(req.user.id, req.validated.params.id, req.validated.params.pageId);
  res.json({ page: result });
}

export async function pages(req, res) {
  const pageList = await auditService.listAuditPages(req.user.id, req.validated.params.id);
  res.json({ pages: pageList });
}

export async function remove(req, res) {
  await auditService.deleteAudit(req.user.id, req.validated.params.id);
  res.status(204).end();
}
