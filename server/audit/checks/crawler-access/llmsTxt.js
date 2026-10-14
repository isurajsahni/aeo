import { defineCheck, statusFromScore } from '../helpers.js';

/**
 * Validate /llms.txt against the llmstxt.org proposal:
 * an H1 title (required), an optional "> " summary, and "## " sections with markdown link lists.
 */
export function analyzeLlmsTxt(text) {
  const lines = text.split(/\r?\n/);
  const firstContent = lines.find((l) => l.trim());
  return {
    hasH1: /^#\s+\S/.test(firstContent ?? ''),
    hasSummary: lines.some((l) => /^>\s*\S/.test(l)),
    sections: lines.filter((l) => /^##\s+\S/.test(l)).map((l) => l.replace(/^##\s+/, '').trim()),
    links: (text.match(/\[[^\]]+\]\([^)\s]+\)/g) ?? []).length,
    bytes: Buffer.byteLength(text),
  };
}

export default defineCheck({
  id: 'llms-txt',
  category: 'crawlerAccess',
  scope: 'site', // evaluated once per site (from the start page), not per page
  title: 'llms.txt file',
  impact: 'low',
  effort: 'low',

  run({ llmsTxt }) {
    const recommendation =
      'Publish /llms.txt: a Markdown file with an H1 site name, a one-line "> " summary, and "## " sections linking to your most important pages. See llmstxt.org.';

    const looksLikeHtml = /html/i.test(llmsTxt.contentType ?? '') || /^\s*<(!doctype|html)/i.test(llmsTxt.text ?? '');
    if (llmsTxt.status !== 200 || !llmsTxt.text?.trim() || looksLikeHtml) {
      return {
        score: 0,
        details: {
          summary:
            llmsTxt.status === 200 && looksLikeHtml
              ? '/llms.txt returns an HTML page (probably a soft 404), not a Markdown file.'
              : `No llms.txt found (${llmsTxt.error?.message ?? `HTTP ${llmsTxt.status ?? 'error'}`}). Adoption is still early, but it's a cheap way to hand AI tools a curated map of your site.`,
          url: llmsTxt.url,
        },
        recommendation,
      };
    }

    const analysis = analyzeLlmsTxt(llmsTxt.text);
    const score = 50 + (analysis.hasH1 ? 20 : 0) + (analysis.hasSummary ? 15 : 0) + (analysis.links > 0 && analysis.sections.length > 0 ? 15 : 0);
    const missing = [
      !analysis.hasH1 && 'an H1 title on the first line ("# Site name")',
      !analysis.hasSummary && 'a "> " summary line',
      !(analysis.links > 0 && analysis.sections.length > 0) && '"## " sections with Markdown links',
    ].filter(Boolean);

    return {
      score,
      status: statusFromScore(score, { pass: 85, warn: 50 }),
      details: {
        summary: missing.length ? `llms.txt exists but is missing ${missing.join(', ')}.` : `Valid llms.txt with ${analysis.sections.length} sections and ${analysis.links} links.`,
        url: llmsTxt.url,
        ...analysis,
      },
      recommendation: missing.length ? `Improve llms.txt: add ${missing.join(', ')}.` : '',
    };
  },
});
