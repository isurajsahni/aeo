import axios from 'axios';
import { config } from '../config/index.js';

const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/**
 * Core Web Vitals from Google PageSpeed Insights (mobile strategy).
 * Prefers real-user field data (CrUX); falls back to Lighthouse lab data.
 *
 * Without PAGESPEED_API_KEY the API works but with a very small shared quota.
 */
export async function fetchCoreWebVitals(url) {
  const { data } = await axios.get(ENDPOINT, {
    params: { url, strategy: 'mobile', category: 'performance', ...(config.pageSpeed.apiKey && { key: config.pageSpeed.apiKey }) },
    timeout: config.pageSpeed.timeoutMs,
  });
  return parsePageSpeed(data);
}

/** Pure parser, exported for tests. */
export function parsePageSpeed(data) {
  const field = data?.loadingExperience?.metrics;
  const audits = data?.lighthouseResult?.audits ?? {};
  const performanceScore = data?.lighthouseResult?.categories?.performance?.score;

  const lab = {
    lcpMs: audits['largest-contentful-paint']?.numericValue ?? null,
    cls: audits['cumulative-layout-shift']?.numericValue ?? null,
    tbtMs: audits['total-blocking-time']?.numericValue ?? null,
    fcpMs: audits['first-contentful-paint']?.numericValue ?? null,
  };

  const hasField = Boolean(field?.LARGEST_CONTENTFUL_PAINT_MS);
  return {
    source: hasField ? 'field' : 'lab',
    lcpMs: hasField ? field.LARGEST_CONTENTFUL_PAINT_MS.percentile : lab.lcpMs,
    inpMs: field?.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
    cls: hasField && field.CUMULATIVE_LAYOUT_SHIFT_SCORE ? field.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : lab.cls,
    tbtMs: lab.tbtMs,
    fcpMs: lab.fcpMs,
    performanceScore: performanceScore != null ? Math.round(performanceScore * 100) : null,
  };
}
