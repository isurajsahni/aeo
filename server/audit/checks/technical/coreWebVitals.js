import { defineCheck, skip, statusFromScore } from '../helpers.js';

// Google's "good" / "needs improvement" thresholds.
const THRESHOLDS = {
  lcpMs: { good: 2500, poor: 4000, label: 'Largest Contentful Paint', unit: 'ms' },
  inpMs: { good: 200, poor: 500, label: 'Interaction to Next Paint', unit: 'ms' },
  tbtMs: { good: 200, poor: 600, label: 'Total Blocking Time (lab proxy for INP)', unit: 'ms' },
  cls: { good: 0.1, poor: 0.25, label: 'Cumulative Layout Shift', unit: '' },
};

const rate = (metric, value) => (value <= THRESHOLDS[metric].good ? 'good' : value <= THRESHOLDS[metric].poor ? 'needs improvement' : 'poor');
const points = { good: 100, 'needs improvement': 50, poor: 0 };

export default defineCheck({
  id: 'core-web-vitals',
  category: 'technical',
  title: 'Core Web Vitals (mobile)',
  impact: 'medium',
  effort: 'high',

  run({ pageSpeed, pageSpeedError }) {
    if (!pageSpeed) return skip(pageSpeedError ?? 'PageSpeed Insights data unavailable.');

    // Field data has INP; lab data uses TBT as the responsiveness proxy.
    const metrics = ['lcpMs', pageSpeed.inpMs != null ? 'inpMs' : 'tbtMs', 'cls'].filter((m) => pageSpeed[m] != null);
    if (!metrics.length) return skip('PageSpeed Insights returned no Core Web Vitals for this URL.');

    const rows = metrics.map((m) => ({
      metric: THRESHOLDS[m].label,
      value: m === 'cls' ? Number(pageSpeed[m].toFixed(3)) : Math.round(pageSpeed[m]),
      unit: THRESHOLDS[m].unit,
      rating: rate(m, pageSpeed[m]),
    }));
    const score = Math.round(rows.reduce((sum, r) => sum + points[r.rating], 0) / rows.length);
    const weak = rows.filter((r) => r.rating !== 'good');

    return {
      score,
      status: statusFromScore(score, { pass: 90, warn: 50 }),
      details: {
        summary: `${pageSpeed.source === 'field' ? 'Real-user (CrUX)' : 'Lab (Lighthouse)'} data: ${rows.map((r) => `${r.metric.split(' (')[0]} ${r.value}${r.unit} (${r.rating})`).join(', ')}.`,
        source: pageSpeed.source,
        performanceScore: pageSpeed.performanceScore,
        metrics: rows,
      },
      recommendation: weak.length
        ? `Improve ${weak.map((r) => r.metric.split(' (')[0]).join(', ')}: compress and correctly size images, preload the hero image, cut unused JavaScript, and reserve space for embeds and ads.`
        : '',
    };
  },
});
