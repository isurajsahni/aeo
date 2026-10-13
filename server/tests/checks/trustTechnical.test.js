import canonical from '../../audit/checks/technical/canonical.js';
import coreWebVitals from '../../audit/checks/technical/coreWebVitals.js';
import https from '../../audit/checks/technical/https.js';
import metaTitle from '../../audit/checks/technical/metaTitle.js';
import statusRedirects from '../../audit/checks/technical/statusRedirects.js';
import aboutContact from '../../audit/checks/trust/aboutContact.js';
import authorByline from '../../audit/checks/trust/authorByline.js';
import privacyPolicy from '../../audit/checks/trust/privacyPolicy.js';
import reviewsTestimonials from '../../audit/checks/trust/reviewsTestimonials.js';
import { check, jsonLd } from '../helpers/context.js';

describe('meta-title', () => {
  test.each([
    ['', 0, 'fail'],
    ['Smile Dental', 40, 'fail'],
    ['Smile Dental | Ludhiana Dentist', 100, 'pass'],
    ['Smile Dental Clinic | Teeth Whitening, Implants & Braces Ludhiana', 70, 'warn'],
  ])('title %p scores %p', (title, score, status) => {
    const result = check(metaTitle, { head: title ? `<title>${title}</title>` : '' });
    expect(result).toMatchObject({ score, status });
  });
});

describe('canonical', () => {
  test('passes a self-referencing canonical, ignoring www and trailing slash', () => {
    const result = check(canonical, { url: 'https://www.example.com/services', head: '<link rel="canonical" href="https://example.com/services/">' });
    expect(result).toMatchObject({ status: 'pass', score: 100 });
  });

  test('warns when the canonical points elsewhere or is missing', () => {
    expect(check(canonical, { url: 'https://example.com/a', head: '<link rel="canonical" href="https://example.com/b">' }).score).toBe(50);
    expect(check(canonical).status).toBe('warn');
  });

  test('fails with conflicting canonicals', () => {
    const head = '<link rel="canonical" href="https://example.com/a"><link rel="canonical" href="https://example.com/b">';
    expect(check(canonical, { url: 'https://example.com/a', head }).status).toBe('fail');
  });
});

describe('https', () => {
  test('fails plain HTTP', () => {
    expect(check(https, { url: 'http://example.com/' }).score).toBe(0);
  });

  test('gives full marks for HTTPS + redirect + HSTS', () => {
    expect(check(https, { headers: { 'strict-transport-security': 'max-age=31536000' } }).score).toBe(100);
  });

  test('flags a missing HTTP -> HTTPS redirect', () => {
    const result = check(https, { httpVariant: { status: 200, finalUrl: 'http://example.com/', redirectsToHttps: false } });
    expect(result.score).toBe(60);
    expect(result.recommendation).toMatch(/301 redirect/);
  });
});

describe('status-redirects', () => {
  test('penalizes long and temporary redirect chains', () => {
    const redirects = [
      { from: 'http://example.com/', to: 'https://example.com/', status: 301 },
      { from: 'https://example.com/', to: 'https://www.example.com/', status: 302 },
    ];
    expect(check(statusRedirects, { redirects }).score).toBe(60);
    expect(check(statusRedirects).score).toBe(100);
  });
});

describe('core-web-vitals', () => {
  test('is skipped without PageSpeed data', () => {
    expect(check(coreWebVitals, { pageSpeedError: 'quota' }).skipped).toBe(true);
  });

  test('rates field metrics against Google thresholds', () => {
    const result = check(coreWebVitals, { pageSpeed: { source: 'field', lcpMs: 2100, inpMs: 350, cls: 0.3, performanceScore: 70 } });
    expect(result.details.metrics.map((m) => m.rating)).toEqual(['good', 'needs improvement', 'poor']);
    expect(result.score).toBe(50);
  });
});

describe('trust checks', () => {
  const footer = '<footer><a href="/about-us">About</a><a href="/contact">Contact</a><a href="/privacy-policy">Privacy Policy</a></footer>';

  test('about-contact and privacy-policy find footer links', () => {
    expect(check(aboutContact, { body: footer })).toMatchObject({ status: 'pass', score: 100 });
    expect(check(privacyPolicy, { body: footer }).score).toBe(100);
    expect(check(aboutContact, { body: '<a href="tel:+911234">Call</a>' }).score).toBe(30);
  });

  test('author-byline is skipped on non-article pages and checks articles', () => {
    expect(check(authorByline).skipped).toBe(true);
    const article = check(authorByline, {
      head: jsonLd({ '@type': 'Article', headline: 'x', author: { '@type': 'Person', name: 'Dr. Kaur', url: 'https://example.com/team/kaur' } }),
    });
    expect(article).toMatchObject({ score: 100, status: 'pass' });
  });

  test('reviews-testimonials prefers review schema over plain text', () => {
    expect(check(reviewsTestimonials, { head: jsonLd({ '@type': 'AggregateRating', ratingValue: 4.8, reviewCount: 120 }) }).score).toBe(100);
    expect(check(reviewsTestimonials, { body: '<main><h2>Testimonials</h2><p>Great clinic!</p></main>' }).score).toBe(60);
    expect(check(reviewsTestimonials).score).toBe(0);
  });
});
