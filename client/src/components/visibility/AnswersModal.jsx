import { CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
import { visibilityApi } from '../../api/endpoints.js';
import { useAsync } from '../../hooks/useAsync.js';
import { cn } from '../../lib/cn.js';
import { Modal } from '../ui/Modal.jsx';
import { ErrorState, PageLoader } from '../ui/States.jsx';

const SENTIMENT = { positive: 'bg-emerald-50 text-emerald-700 ring-emerald-200', neutral: 'bg-slate-100 text-slate-600 ring-slate-200', negative: 'bg-red-50 text-red-700 ring-red-200' };

/** Every stored answer for one prompt (optionally one assistant), with what the analysis found. */
export function AnswersModal({ runId, prompt, provider, providerLabels, onClose }) {
  const { data, error, loading } = useAsync((signal) => visibilityApi.results(runId, { prompt: prompt.promptId, provider }, { signal }), [runId, prompt.promptId, provider]);

  return (
    <Modal open onClose={onClose} title={`“${prompt.text}”`} description={provider ? `Answers from ${providerLabels[provider] ?? provider}` : 'Answers from every assistant'}>
      {loading ? (
        <PageLoader label="Loading answers…" />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <ol className="space-y-4">
          {data.results.map((r) => (
            <li key={r.id} className="rounded-lg ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs">
                <span className="font-semibold text-slate-900">{providerLabels[r.provider] ?? r.provider}</span>
                <span className="text-slate-400">Ask {r.iteration}</span>
                {r.error ? (
                  <span className="ml-auto text-red-600">Failed: {r.error.message}</span>
                ) : (
                  <span className="ml-auto flex flex-wrap items-center gap-1.5">
                    {r.analysis.brandMentioned ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                        <CheckCircle2 className="size-3.5" /> Mentioned{r.analysis.rank ? ` · #${r.analysis.rank} of ${r.analysis.listLength}` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <XCircle className="size-3.5" /> Not mentioned
                      </span>
                    )}
                    {r.analysis.domainCited && <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700 ring-1 ring-brand-200">Site cited</span>}
                    {r.analysis.sentiment && <span className={cn('rounded-full px-2 py-0.5 font-medium ring-1', SENTIMENT[r.analysis.sentiment])}>{r.analysis.sentiment}</span>}
                  </span>
                )}
              </div>
              {!r.error && (
                <div className="space-y-2 px-3 py-2">
                  <p className="max-h-48 overflow-y-auto text-sm whitespace-pre-wrap text-slate-700">{r.answer}</p>
                  {r.analysis.competitorsMentioned?.length > 0 && <p className="text-xs text-slate-500">Competitors mentioned: {r.analysis.competitorsMentioned.join(', ')}</p>}
                  {r.citations?.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-slate-500">{r.citations.length} sources</summary>
                      <ul className="mt-1 space-y-0.5">
                        {r.citations.map((c) => (
                          <li key={c.url}>
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className={cn('inline-flex items-center gap-1 break-all hover:underline', r.analysis.citedUrls?.includes(c.url) ? 'font-medium text-brand-700' : 'text-slate-600')}>
                              {c.title || c.url} <ExternalLink className="size-3 shrink-0" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
