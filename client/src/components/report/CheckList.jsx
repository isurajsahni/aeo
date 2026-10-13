import { ChevronDown, Lightbulb } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn.js';
import { toneFor } from '../../lib/score.js';
import { Card, CardHeader } from '../ui/Card.jsx';
import { CheckStatusIcon, LevelPill } from './Badges.jsx';
import { DetailsView } from './DetailsView.jsx';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'issues', label: 'Issues' },
  { id: 'pass', label: 'Passed' },
];

function CheckRow({ check, open, onToggle }) {
  return (
    <li id={`check-${check.id}`} className="scroll-mt-20">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
      >
        <CheckStatusIcon check={check} />
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium', check.skipped ? 'text-slate-400' : 'text-slate-900')}>{check.title}</p>
          <p className="truncate text-xs text-slate-500">{check.details?.summary}</p>
        </div>
        {!check.skipped && <span className={cn('w-9 text-right text-sm font-semibold tabular-nums', toneFor(check.score).text)}>{check.score}</span>}
        <ChevronDown className={cn('size-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:pl-13">
          {check.details?.summary && <p className="text-sm text-slate-700">{check.details.summary}</p>}
          {check.recommendation && (
            <div className="flex gap-2 rounded-lg bg-brand-50 p-3 text-sm text-brand-900 ring-1 ring-brand-100">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand-600" />
              <p>{check.recommendation}</p>
            </div>
          )}
          <DetailsView details={check.details} />
          {!check.skipped && (
            <div className="flex flex-wrap gap-1.5">
              <LevelPill label="Impact" level={check.impact} />
              <LevelPill label="Effort" level={check.effort} />
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs text-slate-500 ring-1 ring-slate-200">Weight {check.weight}</span>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** All checks grouped by category, each expandable. `focusCheck` ({ id }) opens and scrolls to a check. */
export function CheckList({ checks, categories, activeCategory, focusCheck }) {
  const [filter, setFilter] = useState('all');
  const [openIds, setOpenIds] = useState(() => new Set());

  useEffect(() => {
    if (!focusCheck) return;
    setFilter('all');
    setOpenIds((prev) => new Set(prev).add(focusCheck.id));
    requestAnimationFrame(() => document.getElementById(`check-${focusCheck.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [focusCheck]);

  const toggle = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const matches = (check) =>
    filter === 'all' || (filter === 'pass' ? check.status === 'pass' && !check.skipped : check.status !== 'pass' && !check.skipped);

  const groups = categories
    .filter((category) => !activeCategory || category.id === activeCategory)
    .map((category) => ({ category, checks: checks.filter((c) => c.category === category.id && matches(c)) }))
    .filter((group) => group.checks.length);

  return (
    <Card>
      <CardHeader
        title="All checks"
        description={activeCategory ? 'Filtered to one category. Click the card again to clear.' : 'Click a check for details and how to fix it.'}
        action={
          <div className="flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Filter checks">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={cn('rounded-md px-2.5 py-1 text-xs font-medium', filter === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900')}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />
      {groups.length ? (
        groups.map(({ category, checks: groupChecks }) => (
          <section key={category.id} aria-labelledby={`cat-${category.id}`}>
            <h3 id={`cat-${category.id}`} className="flex items-center justify-between bg-slate-50 px-5 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <span>{category.name}</span>
              <span className={toneFor(category.score).text}>{category.score ?? '–'}/100</span>
            </h3>
            <ul className="divide-y divide-slate-100">
              {groupChecks.map((check) => (
                <CheckRow key={check.id} check={check} open={openIds.has(check.id)} onToggle={() => toggle(check.id)} />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="px-5 py-10 text-center text-sm text-slate-500">No checks match this filter.</p>
      )}
    </Card>
  );
}
