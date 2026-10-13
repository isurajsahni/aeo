import contentSchema from '../../audit/checks/structured-data/contentSchema.js';
import jsonldPresent from '../../audit/checks/structured-data/jsonldPresent.js';
import organizationSchema from '../../audit/checks/structured-data/organizationSchema.js';
import schemaCompleteness from '../../audit/checks/structured-data/schemaCompleteness.js';
import schemaDates from '../../audit/checks/structured-data/schemaDates.js';
import { extractJsonLd } from '../../audit/parsers/jsonld.js';
import * as cheerio from 'cheerio';
import { check, jsonLd } from '../helpers/context.js';

const fullOrg = {
  '@context': 'https://schema.org',
  '@type': 'Dentist',
  name: 'Smile Dental',
  url: 'https://example.com',
  address: { '@type': 'PostalAddress', addressLocality: 'Ludhiana' },
  telephone: '+91-00000-00000',
  openingHoursSpecification: [],
  geo: { '@type': 'GeoCoordinates', latitude: 30.9, longitude: 75.8 },
  image: 'https://example.com/logo.png',
  priceRange: '$$',
  sameAs: ['https://www.facebook.com/smile', 'https://www.linkedin.com/company/smile'],
};

describe('JSON-LD extraction', () => {
  test('flattens @graph, arrays and nested typed nodes and normalizes types', () => {
    const $ = cheerio.load(
      jsonLd({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'http://schema.org/Organization', name: 'Acme' },
          { '@type': ['Article', 'BlogPosting'], headline: 'Hi', author: { '@type': 'Person', name: 'Ada' } },
        ],
      }),
    );
    const { nodes, types, errors } = extractJsonLd($);
    expect(errors).toEqual([]);
    expect(types).toEqual(['Organization', 'Article', 'BlogPosting', 'Person']);
    expect(nodes.find((n) => n.types.includes('Person')).nested).toBe(true);
  });
});

describe('jsonld-present', () => {
  test('fails without JSON-LD', () => {
    expect(check(jsonldPresent)).toMatchObject({ status: 'fail', score: 0 });
  });

  test('reports parse errors', () => {
    const result = check(jsonldPresent, { head: '<script type="application/ld+json">{"@type": "Organization",}</script>' });
    expect(result.status).not.toBe('pass');
    expect(result.details.parseErrors).toHaveLength(1);
  });

  test('passes valid JSON-LD', () => {
    expect(check(jsonldPresent, { head: jsonLd(fullOrg) })).toMatchObject({ status: 'pass', score: 100 });
  });
});

describe('organization-schema', () => {
  test('fails when there is no organization entity', () => {
    expect(check(organizationSchema, { head: jsonLd({ '@type': 'WebSite', name: 'x' }) }).status).toBe('fail');
  });

  test('treats LocalBusiness subtypes (Dentist) as LocalBusiness and passes a complete one', () => {
    const result = check(organizationSchema, { head: jsonLd(fullOrg) });
    expect(result).toMatchObject({ status: 'pass', score: 100 });
    expect(result.details.type).toBe('Dentist');
  });

  test('lists missing fields for a partial Organization', () => {
    const result = check(organizationSchema, { head: jsonLd({ '@type': 'Organization', name: 'Acme' }) });
    expect(result.details.missingRequired).toEqual(['url']);
    expect(result.status).toBe('fail');
    expect(result.recommendation).toMatch(/url/);
  });
});

describe('schema-completeness', () => {
  test('is skipped when there are no supported types', () => {
    expect(check(schemaCompleteness).skipped).toBe(true);
  });

  test('catches FAQ questions without answers', () => {
    const result = check(schemaCompleteness, {
      head: jsonLd({
        '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: 'How much?', acceptedAnswer: { '@type': 'Answer', text: '₹500' } },
          { '@type': 'Question', name: 'Where?' },
        ],
      }),
    });
    const faq = result.details.objects.find((o) => o.type === 'FAQPage');
    expect(faq.issues).toMatch(/missing a name or acceptedAnswer/);
    expect(result.status).not.toBe('pass');
  });
});

describe('content-schema', () => {
  test('asks for FAQPage schema when the page visibly has FAQs', () => {
    const body = '<main><h1>Clinic</h1><h2>FAQ</h2><h3>Does it hurt?</h3><p>No.</p><h3>How long?</h3><p>1h.</p><h3>Cost?</h3><p>Low.</p></main>';
    const result = check(contentSchema, { body, url: 'https://example.com/faq' });
    expect(result.details.expected).toContain('FAQPage');
    expect(result.status).toBe('fail');
  });
});

describe('schema-dates', () => {
  test('requires valid ISO dates on articles', () => {
    const result = check(schemaDates, { head: jsonLd({ '@type': 'Article', headline: 'x', datePublished: 'last tuesday' }) });
    expect(result.score).toBe(0);
    expect(result.recommendation).toMatch(/datePublished/);
  });

  test('passes articles with both dates', () => {
    const result = check(schemaDates, { head: jsonLd({ '@type': 'BlogPosting', datePublished: '2026-01-02', dateModified: '2026-03-04T10:00:00Z' }) });
    expect(result).toMatchObject({ status: 'pass', score: 100 });
  });
});
