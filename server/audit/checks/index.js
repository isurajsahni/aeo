/**
 * Registry of every check, in display order. Add a new check by creating a module
 * with defineCheck() and listing it here; give it a weight in config/scoring.json.
 */
import aiCrawlerRobots from './crawler-access/aiCrawlerRobots.js';
import indexability from './crawler-access/indexability.js';
import jsRendering from './crawler-access/jsRendering.js';
import llmsTxt from './crawler-access/llmsTxt.js';
import sitemap from './crawler-access/sitemap.js';

import breadcrumbSchema from './structured-data/breadcrumbSchema.js';
import contentSchema from './structured-data/contentSchema.js';
import jsonldPresent from './structured-data/jsonldPresent.js';
import organizationSchema from './structured-data/organizationSchema.js';
import schemaCompleteness from './structured-data/schemaCompleteness.js';
import schemaDates from './structured-data/schemaDates.js';

import answerFormats from './content/answerFormats.js';
import contentDepth from './content/contentDepth.js';
import contentFreshness from './content/contentFreshness.js';
import directAnswers from './content/directAnswers.js';
import headingHierarchy from './content/headingHierarchy.js';
import questionHeadings from './content/questionHeadings.js';
import readability from './content/readability.js';

import aboutContact from './trust/aboutContact.js';
import authorByline from './trust/authorByline.js';
import outboundCitations from './trust/outboundCitations.js';
import privacyPolicy from './trust/privacyPolicy.js';
import reviewsTestimonials from './trust/reviewsTestimonials.js';

import canonical from './technical/canonical.js';
import coreWebVitals from './technical/coreWebVitals.js';
import htmlBasics from './technical/htmlBasics.js';
import https from './technical/https.js';
import metaDescription from './technical/metaDescription.js';
import metaTitle from './technical/metaTitle.js';
import openGraph from './technical/openGraph.js';
import statusRedirects from './technical/statusRedirects.js';

export const checks = [
  aiCrawlerRobots, indexability, jsRendering, sitemap, llmsTxt,
  jsonldPresent, organizationSchema, schemaCompleteness, contentSchema, schemaDates, breadcrumbSchema,
  directAnswers, questionHeadings, answerFormats, headingHierarchy, contentDepth, contentFreshness, readability,
  authorByline, aboutContact, reviewsTestimonials, outboundCitations, privacyPolicy,
  https, statusRedirects, metaTitle, coreWebVitals, metaDescription, canonical, openGraph, htmlBasics,
];

export const checksById = new Map(checks.map((check) => [check.id, check]));
