import { jest } from '@jest/globals';
import request from 'supertest';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';

// Don't actually crawl anything: capture enqueued audits instead.
const enqueueAudit = jest.fn();
jest.unstable_mockModule('../services/auditRunner.js', () => ({ enqueueAudit, enqueueVisibilityRun: jest.fn(), initAuditRunner: jest.fn(), recoverInterruptedAudits: jest.fn(), closeAuditRunner: jest.fn() }));

const { createApp } = await import('../app.js');
const { Audit } = await import('../models/Audit.js');
const { Project } = await import('../models/Project.js');

const app = createApp();

beforeAll(startTestDB);
afterEach(async () => {
  enqueueAudit.mockClear();
  await clearTestDB();
});
afterAll(stopTestDB);

async function setup(email = 'owner@agency.test') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ name: 'Owner', email, password: 'Secret123' }).expect(201);
  const { body } = await agent.post('/api/projects').send({ name: 'Smile', domain: 'example.com' }).expect(201);
  return { agent, projectId: body.project.id };
}

describe('audits API', () => {
  test('starts an audit of the homepage and enqueues it', async () => {
    const { agent, projectId } = await setup();
    const res = await agent.post(`/api/projects/${projectId}/audits`).send({}).expect(202);

    expect(res.body.audit).toMatchObject({ url: 'https://example.com/', status: 'queued', crawlConfig: { mode: 'single', maxPages: 1 } });
    expect(enqueueAudit).toHaveBeenCalledTimes(1);
  });

  test('starts a site crawl with a page limit and validates the limit', async () => {
    const { agent, projectId } = await setup();
    const res = await agent.post(`/api/projects/${projectId}/audits`).send({ mode: 'site', maxPages: 10 }).expect(202);
    expect(res.body.audit.crawlConfig).toMatchObject({ mode: 'site', maxPages: 10 });

    await Audit.updateMany({}, { status: 'completed' });
    const defaults = await agent.post(`/api/projects/${projectId}/audits`).send({ mode: 'site' }).expect(202);
    expect(defaults.body.audit.crawlConfig.maxPages).toBe(25);

    await Audit.updateMany({}, { status: 'completed' });
    const tooMany = await agent.post(`/api/projects/${projectId}/audits`).send({ mode: 'site', maxPages: 5000 }).expect(400);
    expect(tooMany.body.error.details[0].path).toBe('maxPages');
  });

  test('marks the audit failed and returns 503 when the queue is down', async () => {
    const { agent, projectId } = await setup();
    enqueueAudit.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await agent.post(`/api/projects/${projectId}/audits`).send({}).expect(503);
    expect(res.body.error.code).toBe('QUEUE_UNAVAILABLE');
    expect(await Audit.findOne({ project: projectId })).toMatchObject({ status: 'failed' });
  });

  test('streams progress over Server-Sent Events until the audit finishes', async () => {
    const { agent, projectId } = await setup();
    const { body } = await agent.post(`/api/projects/${projectId}/audits`).send({}).expect(202);
    const id = body.audit.id;

    setTimeout(() => Audit.updateOne({ _id: id }, { status: 'running', progress: { stage: 'page', message: 'Fetching the page', percent: 20 } }).exec(), 200);
    setTimeout(() => Audit.updateOne({ _id: id }, { status: 'completed', scores: { overall: 80, grade: 'B', categories: [] } }).exec(), 1500);

    const res = await agent.get(`/api/audits/${id}/events`).buffer(true).parse((stream, done) => {
      let text = '';
      stream.on('data', (chunk) => (text += chunk));
      stream.on('end', () => done(null, text));
    });

    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    const events = res.body.split('\n\n').filter((block) => block.startsWith('event:')).map((block) => block.split('\n')[0].slice(7));
    expect(events[0]).toBe('progress');
    expect(events.at(-1)).toBe('done');
    expect(res.body).toContain('"percent":20');
    expect(res.body).toContain('"grade":"B"');
  }, 15_000);

  test('lists pages worst-first and returns one page with its checks', async () => {
    const { agent, projectId } = await setup();
    const { body } = await agent.post(`/api/projects/${projectId}/audits`).send({ mode: 'site', maxPages: 5 }).expect(202);
    const { Page } = await import('../models/Page.js');
    const base = { audit: body.audit.id, project: projectId };
    await Page.create([
      { ...base, url: 'https://example.com/', score: 90, checks: [{ id: 'meta-title', category: 'technical', status: 'pass', score: 100 }] },
      { ...base, url: 'https://example.com/bad', score: 40 },
      { ...base, url: 'https://example.com/broken', statusCode: 500, error: { code: 'PAGE_HTTP_ERROR', message: 'HTTP 500' } },
    ]);

    const list = await agent.get(`/api/audits/${body.audit.id}/pages`).expect(200);
    expect(list.body.pages.map((p) => p.url)).toEqual(['https://example.com/bad', 'https://example.com/', 'https://example.com/broken']);
    expect(list.body.pages[0].checks).toBeUndefined();

    const home = list.body.pages.find((p) => p.score === 90);
    const detail = await agent.get(`/api/audits/${body.audit.id}/pages/${home.id}`).expect(200);
    expect(detail.body.page.checks[0].id).toBe('meta-title');
  });

  test('accepts a specific page on the project domain (or a subdomain) but rejects other sites', async () => {
    const { agent, projectId } = await setup();
    const ok = await agent.post(`/api/projects/${projectId}/audits`).send({ url: 'www.example.com/pricing#plans' }).expect(202);
    expect(ok.body.audit.url).toBe('https://www.example.com/pricing');

    await Audit.updateMany({}, { status: 'completed' });
    const res = await agent.post(`/api/projects/${projectId}/audits`).send({ url: 'https://evil.test/' }).expect(400);
    expect(res.body.error.details[0].path).toBe('url');
  });

  test('allows only one in-flight audit per project', async () => {
    const { agent, projectId } = await setup();
    await agent.post(`/api/projects/${projectId}/audits`).send({}).expect(202);
    const res = await agent.post(`/api/projects/${projectId}/audits`).send({}).expect(409);
    expect(res.body.error.code).toBe('AUDIT_IN_PROGRESS');
  });

  test('lists history, returns full results and a lightweight status', async () => {
    const { agent, projectId } = await setup();
    const { body } = await agent.post(`/api/projects/${projectId}/audits`).send({}).expect(202);
    await Audit.updateOne(
      { _id: body.audit.id },
      { status: 'completed', scores: { overall: 72, grade: 'C', categories: [] }, checks: [{ id: 'meta-title', category: 'technical', title: 'Title', status: 'pass', score: 100, weight: 3, details: { length: 42 } }] },
    );

    const list = await agent.get(`/api/projects/${projectId}/audits`).expect(200);
    expect(list.body.audits).toHaveLength(1);
    expect(list.body.audits[0].checks).toBeUndefined();

    const full = await agent.get(`/api/audits/${body.audit.id}`).expect(200);
    expect(full.body.audit.checks[0]).toMatchObject({ id: 'meta-title', details: { length: 42 } });

    const status = await agent.get(`/api/audits/${body.audit.id}/status`).expect(200);
    expect(status.body.audit).toMatchObject({ status: 'completed', scores: { overall: 72, grade: 'C' } });
  });

  test('audits are private to their owner and deleted with the project', async () => {
    const { agent, projectId } = await setup('alice@agency.test');
    const { body } = await agent.post(`/api/projects/${projectId}/audits`).send({}).expect(202);

    const { agent: bob } = await setup('bob@agency.test');
    await bob.get(`/api/audits/${body.audit.id}`).expect(404);
    await bob.post(`/api/projects/${projectId}/audits`).send({}).expect(404);

    await agent.delete(`/api/projects/${projectId}`).expect(204);
    expect(await Audit.countDocuments({ project: projectId })).toBe(0);
    expect(await Project.countDocuments({ _id: projectId })).toBe(0);
  });
});
