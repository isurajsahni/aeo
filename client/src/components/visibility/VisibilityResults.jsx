import { useState } from 'react';
import { cn } from '../../lib/cn.js';
import { Card, CardHeader } from '../ui/Card.jsx';
import { AnswersModal } from './AnswersModal.jsx';

const pct = (rate) => `${Math.round((rate ?? 0) * 100)}%`;

// Mention-rate tone: ≥50% strong, ≥20% partial, otherwise weak (text colour only; the number carries the value).
const rateTone = (rate) => (rate >= 0.5 ? 'text-emerald-700' : rate >= 0.2 ? 'text-amber-700' : 'text-red-700');
const cellTone = (rate) => (rate >= 0.5 ? 'bg-emerald-50' : rate >= 0.2 ? 'bg-amber-50' : 'bg-red-50/60');

function Bar({ rate, className }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
      <div className={cn('h-full rounded-full', className ?? 'bg-brand-600')} style={{ width: `${Math.round((rate ?? 0) * 100)}%` }} />
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="p-4">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Results of one completed run: headline rates, per assistant, per prompt, and share of voice. */
export function VisibilityResults({ run }) {
  const [open, setOpen] = useState(null); // { prompt, provider? }
  const { summary } = run;
  const providers = summary.providers;
  const labels = Object.fromEntries(providers.map((p) => [p.id, p.label]));
  const { totals } = summary;

  return (
    <div className="space-y-6">
      <Card className="grid grid-cols-2 divide-slate-100 md:grid-cols-4 md:divide-x">
        <Stat label="Mention rate" value={pct(totals.mentionRate)} hint={`${totals.mentions} of ${totals.responses} answers`} />
        <Stat label="Site cited" value={pct(totals.citationRate)} hint={`${totals.citations} answers link to the site`} />
        <Stat label="Avg. position" value={totals.avgRank != null ? `#${totals.avgRank}` : '—'} hint="when listed in a ranked answer" />
        <Stat label="Assistants" value={`${summary.providersMentioning}/${summary.providersTested}`} hint="mention the brand at least once" />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="By AI assistant" description="Share of answers that mention the brand." />
          <ul className="divide-y divide-slate-100">
            {providers.map((p) => (
              <li key={p.id} className="px-5 py-3">
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-900">
                    {p.label} <span className="text-xs font-normal text-slate-400">{p.model}</span>
                  </span>
                  <span className={cn('font-semibold tabular-nums', rateTone(p.mentionRate))}>{pct(p.mentionRate)}</span>
                </div>
                <Bar rate={p.mentionRate} />
                <p className="mt-1.5 text-xs text-slate-500">
                  {p.mentions}/{p.responses} answers · site cited {pct(p.citationRate)}
                  {p.avgRank != null && ` · avg #${p.avgRank}`}
                  {p.errors > 0 && <span className="text-red-600"> · {p.errors} failed</span>}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Share of voice" description="How often each business is mentioned across all answers." />
          {summary.shareOfVoice.length > 1 ? (
            <ul className="divide-y divide-slate-100">
              {summary.shareOfVoice.map((v) => (
                <li key={v.name} className="px-5 py-3">
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span className={cn('font-medium', v.isBrand ? 'text-brand-700' : 'text-slate-900')}>{v.isBrand ? 'Your brand' : v.name}</span>
                    <span className="text-slate-600 tabular-nums">
                      {pct(v.share)} <span className="text-xs text-slate-400">({v.mentions})</span>
                    </span>
                  </div>
                  <Bar rate={v.share} className={v.isBrand ? 'bg-brand-600' : 'bg-slate-400'} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Add competitor domains to the project to compare share of voice.</p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="By prompt" description="Mention rate per prompt and assistant. Click a cell to read the answers." />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-2 text-left">Prompt</th>
                {providers.map((p) => (
                  <th key={p.id} scope="col" className="px-3 py-2 text-center">{p.label}</th>
                ))}
                <th scope="col" className="px-5 py-2 text-right">All</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.prompts.map((prompt) => (
                <tr key={prompt.promptId}>
                  <td className="max-w-xs px-5 py-2.5">
                    <button type="button" onClick={() => setOpen({ prompt })} className="truncate text-left text-slate-900 hover:text-brand-700 hover:underline">
                      {prompt.text}
                    </button>
                  </td>
                  {providers.map((p) => {
                    const cell = prompt.providers[p.id];
                    return (
                      <td key={p.id} className="px-1.5 py-1.5 text-center">
                        {cell?.responses ? (
                          <button
                            type="button"
                            onClick={() => setOpen({ prompt, provider: p.id })}
                            className={cn('w-full rounded-md px-2 py-1.5 font-semibold tabular-nums hover:ring-1 hover:ring-slate-300', cellTone(cell.mentionRate), rateTone(cell.mentionRate))}
                            aria-label={`${p.label}: ${pct(cell.mentionRate)} for "${prompt.text}"`}
                          >
                            {cell.mentions}/{cell.responses}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">{cell?.errors ? 'failed' : '—'}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className={cn('px-5 py-2.5 text-right font-semibold tabular-nums', rateTone(prompt.mentionRate))}>{pct(prompt.mentionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {open && <AnswersModal runId={run.id} prompt={open.prompt} provider={open.provider} providerLabels={labels} onClose={() => setOpen(null)} />}
    </div>
  );
}
