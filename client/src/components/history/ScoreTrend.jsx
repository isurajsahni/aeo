import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate } from '../../lib/format.js';
import { CATEGORY_ORDER } from '../../lib/score.js';

// One series at a time (overall, or one chosen category): no legend needed, one brand hue.
const LINE = '#4f46e5'; // brand-600
const GRID = '#e2e8f0'; // slate-200
const AXIS = '#64748b'; // slate-500
const GRADE_LINES = [
  { y: 90, label: 'A' },
  { y: 80, label: 'B' },
  { y: 70, label: 'C' },
  { y: 60, label: 'D' },
];

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200">
      <p className="font-medium text-slate-900">{formatDate(point.date)}</p>
      <p className="mt-0.5 text-slate-600">
        <span className="font-semibold text-slate-900 tabular-nums">{point.score}</span>/100{point.grade ? ` · grade ${point.grade}` : ''}
      </p>
      <p className="mt-0.5 text-slate-500">{point.scope}</p>
    </div>
  );
}

/** Score over time for completed audits; click a point to open that report. */
export function ScoreTrend({ audits }) {
  const navigate = useNavigate();
  const [series, setSeries] = useState('overall');

  const completed = useMemo(() => audits.filter((a) => a.status === 'completed' && a.scores?.overall != null).reverse(), [audits]);
  const categories = useMemo(() => {
    const seen = new Map();
    for (const a of completed) for (const c of a.scores.categories ?? []) seen.set(c.id, c.name);
    return [...seen].sort(([a], [b]) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));
  }, [completed]);

  // Label points by date; add the time when two audits share a day, so labels stay distinct.
  const dayOf = (a) => new Date(a.completedAt ?? a.createdAt).toDateString();
  const sharedDays = new Set(completed.map(dayOf).filter((day, i, days) => days.indexOf(day) !== i));
  const data = completed.map((a) => {
    const category = a.scores.categories?.find((c) => c.id === series);
    const when = new Date(a.completedAt ?? a.createdAt);
    return {
      id: a.id,
      date: when.toISOString(),
      label: sharedDays.has(dayOf(a))
        ? when.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: series === 'overall' ? a.scores.overall : category?.score ?? null,
      grade: series === 'overall' ? a.scores.grade : category?.grade,
      scope: a.crawlConfig?.mode === 'site' ? `Site crawl · ${a.pageCount} pages` : 'Single page',
    };
  });

  const latest = data.at(-1)?.score;
  const first = data.find((d) => d.score != null)?.score;
  const change = latest != null && first != null ? latest - first : null;

  return (
    <div className="px-5 pt-4 pb-2">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">
            {series === 'overall' ? 'Overall score' : categories.find(([id]) => id === series)?.[1]} over {data.length} audits
          </p>
          {change != null && (
            <p className="text-xs text-slate-500">
              {change === 0 ? 'No change' : `${change > 0 ? '+' : ''}${change} points`} since the first audit
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Show
          <select
            value={series}
            onChange={(e) => setSeries(e.target.value)}
            className="rounded-md border-0 py-1 pr-7 pl-2 text-xs text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-600"
          >
            <option value="overall">Overall score</option>
            {categories.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="h-56" role="img" aria-label={`Score trend: ${data.map((d) => `${d.label} ${d.score}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            {GRADE_LINES.map((g) => (
              <ReferenceLine key={g.y} y={g.y} stroke={GRID} strokeDasharray="3 3" label={{ value: g.label, position: 'right', fill: AXIS, fontSize: 10 }} />
            ))}
            <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: AXIS, strokeDasharray: '3 3' }} />
            <Line
              type="monotone"
              dataKey="score"
              stroke={LINE}
              strokeWidth={2}
              connectNulls
              dot={{ r: 4, fill: LINE, stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, cursor: 'pointer', onClick: (_, point) => navigate(`/audits/${point.payload.id}`) }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
