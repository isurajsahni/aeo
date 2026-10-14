import { ArrowLeft, ArrowRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { auditsApi, projectsApi } from '../api/endpoints.js';
import { CheckStatusIcon, GradeBadge } from '../components/report/Badges.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { cn } from '../lib/cn.js';
import { compareAudits } from '../lib/compare.js';
import { toneFor } from '../lib/score.js';

const when = (a) => new Date(a.completedAt ?? a.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const auditLabel = (a) => `${when(a)} · ${a.scores?.overall}/100 · ${a.crawlConfig?.mode === 'site' ? `${a.pageCount} pages` : 'single page'}`;

function Delta({ value, className }) {
  if (value == null) return <span className={cn('text-slate-400', className)}>—</span>;
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold tabular-nums', value > 0 ? 'text-emerald-600' : value < 0 ? 'text-red-600' : 'text-slate-500', className)}>
      <Icon className="size-3.5" />
      {value > 0 ? `+${value}` : value}
    </span>
  );
}

const CHANGE_LABEL = { regressed: 'Got worse', improved: 'Improved', new: 'Newly checked', removed: 'No longer applies', unchanged: 'No change' };

export default function ComparePage() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();

  const project = useAsync((signal) => projectsApi.get(projectId, { signal }), [projectId]);
  const history = useAsync((signal) => auditsApi.listForProject(projectId, { signal }), [projectId]);
  const completed = useMemo(() => (history.data?.audits ?? []).filter((a) => a.status === 'completed'), [history.data]);

  // Defaults: the latest audit vs the one before it.
  const nextId = params.get('b') ?? completed[0]?.id;
  const baseId = params.get('a') ?? completed[1]?.id;
  const pair = useAsync(
    async (signal) => {
      if (!baseId || !nextId) return null;
      const [{ audit: base }, { audit: next }] = await Promise.all([auditsApi.get(baseId, { signal }), auditsApi.get(nextId, { signal })]);
      return { base, next };
    },
    [baseId, nextId],
  );
  const diff = useMemo(() => (pair.data ? compareAudits(pair.data.base, pair.data.next) : null), [pair.data]);

  const back = (
    <Link to={`/projects/${projectId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
      <ArrowLeft className="size-4" /> Back to project
    </Link>
  );

  if (history.loading && !history.data) return <PageLoader label="Loading audits…" />;
  if (history.error) return <ErrorState title="Couldn’t load audits" error={history.error} onRetry={history.reload} />;
  if (completed.length < 2) {
    return (
      <div className="space-y-6">
        {back}
        <EmptyState title="Not enough audits to compare" description="Run at least two audits on this project, then compare them here." />
      </div>
    );
  }

  const select = (key, value, label) => (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-slate-500">
      {label}
      <select
        value={value ?? ''}
        onChange={(e) => setParams((prev) => ({ a: baseId, b: nextId, ...Object.fromEntries(prev), [key]: e.target.value }))}
        className="w-full rounded-lg border-0 py-2 pr-8 pl-3 text-sm text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-600"
      >
        {completed.map((a) => (
          <option key={a.id} value={a.id}>
            {auditLabel(a)}
          </option>
        ))}
      </select>
    </label>
  );

  const groups = diff ? ['regressed', 'improved', 'new', 'removed'].map((change) => ({ change, items: diff.checks.filter((c) => c.change === change) })).filter((g) => g.items.length) : [];

  return (
    <div className="space-y-6">
      {back}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Compare audits</h1>
        <p className="mt-1 text-sm text-slate-500">{project.data?.project.name}</p>
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        {select('a', baseId, 'Before')}
        <ArrowRight className="mx-auto hidden size-5 shrink-0 text-slate-400 sm:mb-2.5 sm:block" />
        {select('b', nextId, 'After')}
      </Card>

      {pair.loading && !pair.data ? (
        <PageLoader label="Comparing…" />
      ) : pair.error ? (
        <ErrorState title="Couldn’t load these audits" error={pair.error} onRetry={pair.reload} />
      ) : diff ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="flex items-center justify-between p-5 md:col-span-1">
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Overall score</p>
                <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900 tabular-nums">
                  <span className="text-slate-400">{diff.overall.before}</span>
                  <ArrowRight className="size-4 text-slate-400" />
                  <span className={toneFor(diff.overall.after).text}>{diff.overall.after}</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Delta value={diff.overall.delta} className="text-lg" />
                <span className="flex items-center gap-1">
                  <GradeBadge grade={diff.grade.before} score={diff.overall.before} size="sm" />
                  <ArrowRight className="size-3 text-slate-400" />
                  <GradeBadge grade={diff.grade.after} score={diff.overall.after} size="sm" />
                </span>
              </div>
            </Card>
            <Card className="grid grid-cols-3 divide-x divide-slate-100 md:col-span-2">
              {[
                ['Improved', diff.counts.improved, 'text-emerald-600'],
                ['Got worse', diff.counts.regressed, 'text-red-600'],
                ['No change', diff.counts.unchanged, 'text-slate-600'],
              ].map(([label, value, color]) => (
                <div key={label} className="p-5 text-center">
                  <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
                  <p className="text-xs text-slate-500">{label} checks</p>
                </div>
              ))}
            </Card>
          </div>

          <Card>
            <CardHeader title="By category" />
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2">Category</th>
                  <th scope="col" className="px-3 py-2 text-right">Before</th>
                  <th scope="col" className="px-3 py-2 text-right">After</th>
                  <th scope="col" className="px-5 py-2 text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {diff.categories.map((c) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-3 py-3 text-right text-slate-500 tabular-nums">{c.before ?? '—'}</td>
                    <td className={cn('px-3 py-3 text-right font-semibold tabular-nums', toneFor(c.after).text)}>{c.after ?? '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <Delta value={c.delta} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <CardHeader title="What changed" description="Checks whose status changed, or whose score moved by 5+ points." />
            {groups.length ? (
              groups.map(({ change, items }) => (
                <section key={change}>
                  <h3 className="bg-slate-50 px-5 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    {CHANGE_LABEL[change]} ({items.length})
                  </h3>
                  <ul className="divide-y divide-slate-100">
                    {items.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                        <span className="flex items-center gap-1">
                          {c.before ? <CheckStatusIcon check={c.before} className="size-4" /> : <span className="size-4" />}
                          <ArrowRight className="size-3 text-slate-300" />
                          {c.after ? <CheckStatusIcon check={c.after} className="size-4" /> : <span className="size-4" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-slate-900">{c.title}</span>
                        <span className="text-slate-400 tabular-nums">
                          {c.before?.skipped ? '–' : c.before?.score ?? '–'} → {c.after?.skipped ? '–' : c.after?.score ?? '–'}
                        </span>
                        <Delta value={c.delta} className="w-12 justify-end" />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            ) : (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No check changed between these two audits.</p>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
