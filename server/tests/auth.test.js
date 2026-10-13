import request from 'supertest';
import { createApp } from '../app.js';
import { clearTestDB, startTestDB, stopTestDB } from './helpers/db.js';

const app = createApp();
const credentials = { name: 'Ada Agency', email: 'ada@agency.test', password: 'Secret123' };

beforeAll(startTestDB);
afterEach(clearTestDB);
afterAll(stopTestDB);

const getCookie = (res) => res.headers['set-cookie']?.find((c) => c.startsWith('aeo_token='));

describe('POST /api/auth/register', () => {
  test('creates a user, sets an httpOnly cookie and never returns the password', async () => {
    const res = await request(app).post('/api/auth/register').send(credentials).expect(201);

    expect(res.body.user).toMatchObject({ name: 'Ada Agency', email: 'ada@agency.test' });
    expect(res.body.user.id).toBeDefined();
    expect(res.body.user.password).toBeUndefined();

    const cookie = getCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  test('normalizes email case and rejects duplicates', async () => {
    await request(app).post('/api/auth/register').send(credentials).expect(201);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...credentials, email: 'ADA@Agency.test' })
      .expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  test('returns field-level validation errors', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'nope', password: 'short' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => request(app).post('/api/auth/register').send(credentials));

  test('logs in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(200);
    expect(getCookie(res)).toBeDefined();
    expect(res.body.user.email).toBe(credentials.email);
  });

  test('uses the same error for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'Wrong1234' })
      .expect(401);
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@agency.test', password: 'Wrong1234' })
      .expect(401);

    expect(wrongPassword.body.error).toEqual(unknownEmail.body.error);
  });
});

describe('session lifecycle', () => {
  test('GET /me requires a session, works after login, and fails after logout', async () => {
    const agent = request.agent(app);

    await agent.get('/api/auth/me').expect(401);
    await agent.post('/api/auth/register').send(credentials).expect(201);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.email).toBe(credentials.email);

    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  test('rejects a tampered token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'aeo_token=eyJhbGciOiJIUzI1NiJ9.e30.invalidsignature')
      .expect(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });
});

describe('error handling', () => {
  test('unknown routes return a JSON 404', async () => {
    const res = await request(app).get('/api/nope').expect(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  test('malformed JSON returns a 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});
