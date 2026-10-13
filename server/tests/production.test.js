import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { serveClient } from '../middleware/serveClient.js';
import { isRegistrationAllowed } from '../services/registration.js';

describe('registration policy', () => {
  test('open with no allowlist lets anyone sign up', () => {
    expect(isRegistrationAllowed('anyone@gmail.com', { open: true, allowlist: [] })).toBe(true);
  });

  test('closed blocks everyone', () => {
    expect(isRegistrationAllowed('owner@agency.com', { open: false, allowlist: ['owner@agency.com'] })).toBe(false);
  });

  test('allowlist accepts exact emails and whole domains, case-insensitively', () => {
    const settings = { open: true, allowlist: ['@mutantx.xyz', 'client@gmail.com'] };
    expect(isRegistrationAllowed('Suraj@MutantX.xyz', settings)).toBe(true);
    expect(isRegistrationAllowed('client@gmail.com', settings)).toBe(true);
    expect(isRegistrationAllowed('stranger@gmail.com', settings)).toBe(false);
    expect(isRegistrationAllowed('evil@notmutantx.xyz', settings)).toBe(false);
  });
});

describe('serving the built client', () => {
  const dist = mkdtempSync(path.join(tmpdir(), 'aeo-dist-'));
  mkdirSync(path.join(dist, 'assets'));
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><div id="root"></div>');
  writeFileSync(path.join(dist, 'assets', 'app-abc123.js'), 'console.log(1)');

  const app = express();
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use(serveClient(dist));
  app.use((_req, res) => res.status(404).json({ error: 'not found' }));

  test('client routes get the SPA shell, uncached, with a CSP', async () => {
    const res = await request(app).get('/projects/123').expect(200);
    expect(res.text).toContain('<div id="root">');
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.headers['content-security-policy']).toMatch(/script-src 'self'/);
  });

  test('hashed assets are cached long-term and missing assets 404', async () => {
    const res = await request(app).get('/assets/app-abc123.js').expect(200);
    expect(res.headers['cache-control']).toMatch(/max-age=31536000.*immutable/);
    await request(app).get('/assets/missing.js').expect(404);
  });

  test('API routes are never swallowed by the SPA fallback', async () => {
    await request(app).get('/api/health').expect(200, { ok: true });
    await request(app).get('/api/unknown').expect(404);
  });
});
