import { normalizeDomain } from '../utils/domain.js';

describe('normalizeDomain', () => {
  test.each([
    ['example.com', 'example.com'],
    ['  Example.COM  ', 'example.com'],
    ['https://www.example.com/pricing?x=1#top', 'www.example.com'],
    ['http://blog.example.co.uk', 'blog.example.co.uk'],
    ['example.com:8080', 'example.com'],
    ['example.com.', 'example.com'],
    ['münchen.de', 'xn--mnchen-3ya.de'],
  ])('normalizes %p to %p', (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  test.each([
    '',
    'localhost',
    'http://localhost:3000',
    'printer.local',
    'api.internal',
    '127.0.0.1',
    '10.0.0.5',
    'http://[::1]/',
    'ftp://example.com',
    'javascript:alert(1)',
    'https://user:pass@example.com',
    'not a domain',
    'nodot',
    '-bad.example.com',
    'bad-.example.com',
    null,
    42,
  ])('rejects %p', (input) => {
    expect(normalizeDomain(input)).toBeNull();
  });
});
