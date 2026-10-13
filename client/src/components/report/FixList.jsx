import { useState } from 'react';
import { Card, CardHeader } from '../ui/Card.jsx';
import { BucketPill, LevelPill } from './Badges.jsx';

const INITIAL = 6;

export function FixList({ fixes, categoryNames, onJumpToCheck }) {
  const [expanded, setExpanded] = useState(false);
  if (!fixes.length) return null;
  const visible = expanded ? fixes : fixes.slice(0, INITIAL);

  return (
    <Card>
      <CardHeader title="Prioritized fixes" description="Ranked by impact versus effort. Start at the top." />
      <ol className="divide-y divide-slate-100">
        {visible.map((fix, index) => (
          <li key={fix.checkId} className="flex gap-4 px-5 py-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onJumpToCheck(fix.checkId)} className="text-left font-medium text-slate-900 hover:text-brand-700 hover:underline">
                  {fix.title}
                </button>
                <BucketPill bucket={fix.bucket} />
              </div>
              <p className="mt-1 text-sm text-slate-600">{fix.recommendation}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <LevelPill label="Impact" level={fix.impact} />
                <LevelPill label="Effort" level={fix.effort} />
                <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs text-slate-500 ring-1 ring-slate-200">{categoryNames[fix.category] ?? fix.category}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {fixes.length > INITIAL && (
        <div className="border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={() => setExpanded((v) => !v)} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            {expanded ? 'Show fewer' : `Show all ${fixes.length} fixes`}
          </button>
        </div>
      )}
    </Card>
  );
}
