import request from 'supertest';
import { createApp } from '../app.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';

const app = createApp();

beforeAll(startTestDB);
afterEach(clearTestDB);
afterAll(stopTestDB);

async function loggedInAgent(email = 'owner@agency.test') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ name: 'Owner', email, password: 'Secret123' }).expect(201);
  return agent;
}

const sample = {
  name: 'Smile Dental',
  domain: 'https://www.SmileDental.example.com/contact',
  competitors: ['rival-dental.com', 'https://rival-dental.com/', 'other-clinic.com'],
};

describe('projects API', () => {
  test('requires authentication', async () => {
    await request(app).get('/api/projects').expect(401);
  });

  test('creates a project with a normalized domain and de-duplicated competitors', async () => {
    const agent = await loggedInAgent();
    const res = await agent.post('/api/projects').send(sample).expect(201);

    expect(res.body.project).toMatchObject({
      name: 'Smile Dental',
      domain: 'www.smiledental.example.com',
      competitors: ['rival-dental.com', 'other-clinic.com'],
      notes: '',
    });
  });

  test('lists, reads, updates and deletes a project', async () => {
    const agent = await loggedInAgent();
    const { body: created } = await agent.post('/api/projects').send(sample).expect(201);
    const id = created.project.id;

    const list = await agent.get('/api/projects').expect(200);
    expect(list.body.projects).toHaveLength(1);

    await agent.get(`/api/projects/${id}`).expect(200);

    const updated = await agent.patch(`/api/projects/${id}`).send({ name: 'Smile Dental Clinic' }).expect(200);
    expect(updated.body.project.name).toBe('Smile Dental Clinic');
    // Fields not sent in a PATCH are left untouched.
    expect(updated.body.project.competitors).toHaveLength(2);

    await agent.delete(`/api/projects/${id}`).expect(204);
    await agent.get(`/api/projects/${id}`).expect(404);
  });

  test('rejects private hosts and invalid input', async () => {
    const agent = await loggedInAgent();
    const res = await agent
      .post('/api/projects')
      .send({ name: 'Bad', domain: 'http://localhost:3000', competitors: ['10.0.0.1'] })
      .expect(400);

    const paths = res.body.error.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['domain', 'competitors.0']));
  });

  test('rejects the project’s own domain as a competitor', async () => {
    const agent = await loggedInAgent();
    await agent
      .post('/api/projects')
      .send({ name: 'Self', domain: 'example.com', competitors: ['example.com'] })
      .expect(400);
  });

  test('prevents duplicate domains for the same user but allows them across users', async () => {
    const alice = await loggedInAgent('alice@agency.test');
    const bob = await loggedInAgent('bob@agency.test');

    await alice.post('/api/projects').send({ name: 'A', domain: 'example.com' }).expect(201);
    const dup = await alice.post('/api/projects').send({ name: 'B', domain: 'EXAMPLE.com' }).expect(409);
    expect(dup.body.error.code).toBe('DUPLICATE_DOMAIN');

    await bob.post('/api/projects').send({ name: 'A', domain: 'example.com' }).expect(201);
  });

  test('users cannot see or modify other users’ projects', async () => {
    const alice = await loggedInAgent('alice@agency.test');
    const bob = await loggedInAgent('bob@agency.test');
    const { body } = await alice.post('/api/projects').send({ name: 'Private', domain: 'example.com' }).expect(201);
    const id = body.project.id;

    await bob.get(`/api/projects/${id}`).expect(404);
    await bob.patch(`/api/projects/${id}`).send({ name: 'Hijacked' }).expect(404);
    await bob.delete(`/api/projects/${id}`).expect(404);
    expect((await bob.get('/api/projects').expect(200)).body.projects).toHaveLength(0);
  });

  test('validates ids and empty updates', async () => {
    const agent = await loggedInAgent();
    await agent.get('/api/projects/not-an-id').expect(400);

    const { body } = await agent.post('/api/projects').send({ name: 'X', domain: 'example.com' }).expect(201);
    await agent.patch(`/api/projects/${body.project.id}`).send({}).expect(400);
  });
});
