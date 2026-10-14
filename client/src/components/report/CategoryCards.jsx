import { cn } from '../../lib/cn.js';
import { CATEGORY_DESCRIPTIONS, toneFor } from '../../lib/score.js';
import { ScoreBar } from './ScoreGauge.jsx';

export function CategoryCards({ categories, activeCategory, onSelect }) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', categories.length > 5 ? 'md:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-5')}>
      {categories.map((category) => {
        const active = activeCategory === category.id;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(active ? null : category.id)}
            aria-pressed={active}
            className={cn(
              'flex flex-col rounded-xl bg-white p-4 text-left shadow-sm ring-1 transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand-600',
              active ? 'ring-2 ring-brand-500' : 'ring-slate-200',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{category.name}</h3>
              <span className={cn('text-2xl font-bold tabular-nums', toneFor(category.score).text)}>{category.score ?? '–'}</span>
            </div>
            <p className="mt-1 mb-3 line-clamp-2 text-xs text-slate-500">{CATEGORY_DESCRIPTIONS[category.id]}</p>
            <div className="mt-auto space-y-2">
              <ScoreBar score={category.score} />
              <p className="flex gap-3 text-xs text-slate-500">
                <span className="text-emerald-600">{category.counts.pass} pass</span>
                <span className="text-amber-600">{category.counts.warn} warn</span>
                <span className="text-red-600">{category.counts.fail} fail</span>
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
