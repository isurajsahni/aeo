/**
 * Roll a run's individual answers up into rates. AI answers vary from run to run,
 * so everything is reported as a rate over repeated asks, never a single yes/no.
 */

const rate = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 1000 : 0);
const average = (values) => (values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null);

function stats(results) {
  const ok = results.filter((r) => !r.error && r.analysis);
  const mentions = ok.filter((r) => r.analysis.brandMentioned);
  const ranks = mentions.map((r) => r.analysis.rank).filter((n) => n != null);
  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const r of mentions) if (r.analysis.sentiment) sentiment[r.analysis.sentiment] += 1;
  const citations = ok.filter((r) => r.analysis.domainCited).length;
  return {
    responses: ok.length,
    errors: results.length - ok.length,
    mentions: mentions.length,
    mentionRate: rate(mentions.length, ok.length),
    citations,
    citationRate: rate(citations, ok.length),
    avgRank: average(ranks),
    sentiment,
  };
}

/**
 * @param results   [{ prompt, provider, analysis, error }]
 * @param prompts   [{ id, text }]
 * @param providers [{ id, label, model }]
 * @param competitors [domain]
 */
export function summarizeRun({ results, prompts, providers, competitors = [] }) {
  const byProvider = providers.map((p) => {
    const mine = results.filter((r) => r.provider === p.id);
    const s = stats(mine);
    const promptsMentioned = prompts.filter((q) => mine.some((r) => String(r.prompt) === String(q.id) && r.analysis?.brandMentioned)).length;
    return { id: p.id, label: p.label, model: p.model, ...s, promptCoverage: rate(promptsMentioned, prompts.length) };
  });

  const byPrompt = prompts.map((q) => {
    const mine = results.filter((r) => String(r.prompt) === String(q.id));
    return {
      promptId: String(q.id),
      text: q.text,
      ...stats(mine),
      providers: Object.fromEntries(providers.map((p) => [p.id, stats(mine.filter((r) => r.provider === p.id))])),
    };
  });

  // Share of voice: how often the brand appears vs each competitor, across all answers.
  const ok = results.filter((r) => !r.error && r.analysis);
  const brandMentions = ok.filter((r) => r.analysis.brandMentioned).length;
  const voices = [
    { name: 'brand', isBrand: true, mentions: brandMentions },
    ...competitors.map((domain) => ({ name: domain, isBrand: false, mentions: ok.filter((r) => r.analysis.competitorsMentioned?.includes(domain)).length })),
  ];
  const totalVoice = voices.reduce((sum, v) => sum + v.mentions, 0);
  const shareOfVoice = voices.map((v) => ({ ...v, share: rate(v.mentions, totalVoice) })).sort((a, b) => b.mentions - a.mentions);

  return {
    totals: stats(results),
    providers: byProvider,
    prompts: byPrompt,
    shareOfVoice,
    providersMentioning: byProvider.filter((p) => p.mentions > 0).length,
    providersTested: byProvider.filter((p) => p.responses > 0).length,
  };
}
