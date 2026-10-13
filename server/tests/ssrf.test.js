import { assertSafeUrl, isPublicIp, safeLookup } from '../utils/ssrf.js';

describe('isPublicIp', () => {
  test.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111'])('allows public %s', (ip) => {
    expect(isPublicIp(ip)).toBe(true);
  });

  test.each([
    '127.0.0.1', // loopback
    '10.1.2.3', // private
    '172.16.0.1', // private
    '192.168.1.10', // private
    '169.254.169.254', // link-local (cloud metadata!)
    '100.64.0.1', // carrier-grade NAT
    '0.0.0.0', // unspecified
    '224.0.0.1', // multicast
    '255.255.255.255', // broadcast
    '::1', // IPv6 loopback
    'fc00::1', // IPv6 unique local
    'fe80::1', // IPv6 link-local
    '::ffff:127.0.0.1', // IPv4-mapped loopback
    '::ffff:169.254.169.254', // IPv4-mapped metadata
    'not-an-ip',
  ])('blocks %s', (ip) => {
    expect(isPublicIp(ip)).toBe(false);
  });
});

describe('assertSafeUrl', () => {
  test('accepts normal public URLs', () => {
    expect(assertSafeUrl('https://example.com/page?x=1').hostname).toBe('example.com');
    expect(assertSafeUrl('http://93.184.216.34/').hostname).toBe('93.184.216.34');
  });

  test.each([
    'file:///etc/passwd',
    'ftp://example.com/',
    'gopher://example.com/',
    'http://localhost/',
    'http://app.localhost/',
    'http://127.0.0.1:4000/api',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/',
    'https://user:pass@example.com/',
    'http://example.com:6379/',
    'not a url',
  ])('rejects %s', (url) => {
    expect(() => assertSafeUrl(url)).toThrow();
  });
});

describe('safeLookup (connect-time DNS guard)', () => {
  const lookup = (host) => new Promise((resolve) => safeLookup(host, {}, (err, address) => resolve({ err, address })));

  test('refuses hostnames that resolve to loopback', async () => {
    const { err } = await lookup('localhost');
    expect(err?.code).toBe('BLOCKED_URL');
  });
});
