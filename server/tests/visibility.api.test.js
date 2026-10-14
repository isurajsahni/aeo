import { jest } from '@jest/globals';
import request from 'supertest';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';

// Queue: capture enqueued runs and execute them on demand with fake providers.
const enqueueVisibilityRun = jest.fn();
jest.unstable_mockModule('../services/auditRunner.js', () => ({ enqueueAudit: jest.fn(), enqueueVisibilityRun, initAuditRunner: jest.fn(), recoverInterruptedAudits: jest.fn(), closeAuditRunner: jest.fn() }));

const { createApp } = await import('../app.js');
const { setProvidersForTesting } = await import('../providers/index.js');
const { ProviderAdapter } = await import('../providers/base.js');
const { runVisibility } = await import('../visibility/runVisibility.js');
const { VisibilityRun } = await import('../models/VisibilityRun.js');
const { AiResult } = await import('../models/AiResult.js');

/** A scripted assistant: answers by calling `reply(prompt, callNumber)`. */
class FakeProvider extends ProviderAdapter {
  constructor(id, reply) {
    super({ id, label: id.toUpperCase(), model: `${id}-model` });
    this.reply = reply;
    this.calls = 0;
  }
  async ask({ prompt }) {
    this.calls += 1;
    return this.reply(prompt, this.calls);
  }
}

const app = createApp();
let alpha;
let beta;

beforeAll(startTestDB);
beforeEach(() => {
  alpha = new FakeProvider('openai', (prompt, n) => ({ text: n % 2 ? `1. Smile Dental is the best for "${prompt}"` : 'Try BrightSmile.', citations: n % 2 ? [{ url: 'https://smiledental.in/' }] : [], model: 'openai-model', usage: { inputTokens: 1, outputTokens: 2 } }));
  beta = new FakeProvider('perplexity', () => {
    throw Object.assign(new Error('Perplexity is down'), { status: 503 });
  });
  setProvidersForTesting([alpha, beta]);
});
afterEach(async () => {
  enqueueVisibilityRun.mockClear();
  await clearTestDB();
});
afterAll(stopTestDB);

async function setup() {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ name: 'Owner', email: 'owner@agency.test', password: 'Secret123' }).expect(201);
  const { body } = await agent.post('/api/projects').send({ name: 'Smile Dental', domain: 'smiledental.in', competitors: ['brightsmile.com'] }).expect(201);
  return { agent, projectId: body.project.id };
}

test('prompt CRUD with validation and ownership', async () => {
  const { agent, projectId } = await setup();
  const created = await agent.post(`/api/projects/${projectId}/prompts`).send({ text: 'best dentist in Ludhiana', location: { city: 'Ludhiana', country: 'in' } }).expect(201);
  expect(created.body.prompt).toMatchObject({ text: 'best dentist in Ludhiana', active: true, location: { city: 'Ludhiana', country: 'IN' } });

  await agent.post(`/api/projects/${projectId}/prompts`).send({ text: 'x' }).expect(400);
  await agent.post(`/api/projects/${projectId}/prompts`).send({ text: 'ok prompt', location: { country: 'India' } }).expect(400);

  const id = created.body.prompt.id;
  const updated = await agent.patch(`/api/projects/${projectId}/prompts/${id}`).send({ active: false }).expect(200);
  expect(updated.body.prompt.active).toBe(false);
  expect((await agent.get(`/api/projects/${projectId}/prompts`).expect(200)).body.prompts).toHaveLength(1);

  const other = request.agent(app);
  await other.post('/api/auth/register').send({ name: 'Other', email: 'other@agency.test', password: 'Secret123' }).expect(201);
  await other.get(`/api/projects/${projectId}/prompts`).expect(404);

  await agent.delete(`/api/projects/${projectId}/prompts/${id}`).expect(204);
});

test('lists configured providers', async () => {
  const { agent } = await setup();
  const res = await agent.get('/api/visibility/providers').expect(200);
  expect(res.body.providers.map((p) => p.id)).toEqual(['openai', 'perplexity']);
});

test('validates runs: prompts required, providers configured, call cap', async () => {
  const { agent, projectId } = await setup();
  const noPrompts = await agent.post(`/api/projects/${projectId}/visibility-runs`).send({}).expect(400);
  expect(noPrompts.body.error.code).toBe('NO_PROMPTS');

  await agent.post(`/api/projects/${projectId}/prompts`).send({ text: 'best dentist in Ludhiana' }).expect(201);
  const notConfigured = await agent.post(`/api/projects/${projectId}/visibility-runs`).send({ providers: ['gemini'] }).expect(400);
  expect(notConfigured.body.error.details[0].path).toBe('providers');

  const tooMany = await agent.post(`/api/projects/${projectId}/visibility-runs`).send({ runsPerPrompt: 10 }).expect(202);
  expect(tooMany.body.run.progress.total).toBe(20); // 1 prompt x 2 providers x 10
});

test('end to end: run, partial provider failure, rates, results, category F in the next audit', async () => {
  const { agent, projectId } = await setup();
  await agent.post(`/api/projects/${projectId}/prompts`).send({ text: 'best dentist in Ludhiana' }).expect(201);
  await agent.post(`/api/projects/${projectId}/prompts`).send({ text: 'teeth whitening price' }).expect(201);

  const { body } = await agent.post(`/api/projects/${projectId}/visibility-runs`).send({ runsPerPrompt: 2 }).expect(202);
  expect(String(enqueueVisibilityRun.mock.calls[0][0])).toBe(body.run.id);
  await agent.post(`/api/projects/${projectId}/visibility-runs`).send({}).expect(409);

  await runVisibility(body.run.id, { providers: [alpha, beta], concurrency: 2 });

  const run = (await agent.get(`/api/visibility/runs/${body.run.id}`).expect(200)).body.run;
  expect(run.status).toBe('completed');
  expect(run.progress).toMatchObject({ done: 8, total: 8 });
  const openai = run.summary.providers.find((p) => p.id === 'openai');
  expect(openai).toMatchObject({ responses: 4, mentions: 2, mentionRate: 0.5, citationRate: 0.5, avgRank: 1 });
  expect(run.summary.providers.find((p) => p.id === 'perplexity')).toMatchObject({ responses: 0, errors: 4 });
  expect(run.summary.shareOfVoice.map((v) => [v.name, v.mentions])).toEqual([['brand', 2], ['brightsmile.com', 2]]);

  const results = (await agent.get(`/api/visibility/runs/${body.run.id}/results?provider=openai`).expect(200)).body.results;
  expect(results).toHaveLength(4);
  expect(results[0]).toMatchObject({ provider: 'openai', analysis: { brandMentioned: true, rank: 1 } });

  const history = (await agent.get(`/api/projects/${projectId}/visibility-runs`).expect(200)).body.runs;
  expect(history[0].summary.totals.mentionRate).toBe(0.5);

  // Category F is pulled into the next audit.
  const { runAudit } = await import('../audit/runAudit.js');
  const { Audit } = await import('../models/Audit.js');
  const { html } = await import('./helpers/context.js');
  const { buildContext } = await import('../audit/context.js');
  const audit = await Audit.create({ user: run.user, project: projectId, url: 'https://smiledental.in/' });
  await runAudit(audit.id, {
    gather: async (url) => buildContext({ url, page: { url, status: 200, headers: {}, text: html('<main><h1>Smile</h1></main>') }, robots: { status: 404 } }),
  });
  const done = await Audit.findById(audit.id);
  const mention = done.checks.find((c) => c.id === 'ai-mention-rate');
  expect(mention).toMatchObject({ category: 'aiVisibility', skipped: false, score: 83 }); // 50% of a 60% target
  expect(done.scores.categories.map((c) => c.id)).toContain('aiVisibility');
  expect(String(done.visibilityRun)).toBe(body.run.id);
});

test('a run where every request fails is marked failed with the first error', async () => {
  const { agent, projectId } = await setup();
  await agent.post(`/api/projects/${projectId}/prompts`).send({ text: 'best dentist in Ludhiana' }).expect(201);
  const { body } = await agent.post(`/api/projects/${projectId}/visibility-runs`).send({ providers: ['perplexity'], runsPerPrompt: 1 }).expect(202);
  await runVisibility(body.run.id, { providers: [alpha, beta] });
  const run = await VisibilityRun.findById(body.run.id);
  expect(run.status).toBe('failed');
  expect(run.error.message).toMatch(/Perplexity is down/);
  expect(await AiResult.countDocuments({ run: run._id })).toBe(1);
});
