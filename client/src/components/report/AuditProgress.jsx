import { Check, Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { Card } from '../ui/Card.jsx';

const STAGES = [
  { id: 'robots', label: 'Reading robots.txt' },
  { id: 'page', label: 'Fetching the page' },
  { id: 'discovery', label: 'Checking llms.txt and sitemap' },
  { id: 'render', label: 'Rendering JavaScript & measuring Core Web Vitals' },
  { id: 'checks', label: 'Running checks and scoring' },
];

/** Live progress card shown while an audit is queued or running. */
export function AuditProgress({ audit }) {
  const percent = audit.progress?.percent ?? 0;
  const currentIndex = STAGES.findIndex((s) => s.id === audit.progress?.stage);

  return (
    <Card className="mx-auto max-w-xl p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <Loader2 className="size-6 animate-spin text-brand-600" />
        <div>
          <h2 className="font-semibold text-slate-900">{audit.status === 'queued' ? 'Waiting for a free slot…' : 'Auditing your page'}</h2>
          <p className="text-sm text-slate-500">This usually takes 15-60 seconds. You can leave this page; the audit keeps running.</p>
        </div>
      </div>

      <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-brand-600 transition-all duration-700" style={{ width: `${Math.max(4, percent)}%` }} />
      </div>

      <ol className="mt-6 space-y-3">
        {STAGES.map((stage, index) => {
          const done = currentIndex > index;
          const active = currentIndex === index;
          return (
            <li key={stage.id} className="flex items-center gap-3 text-sm">
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full',
                  done ? 'bg-emerald-100 text-emerald-600' : active ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-400',
                )}
              >
                {done ? <Check className="size-3.5" /> : active ? <Loader2 className="size-3.5 animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
              </span>
              <span className={cn(done ? 'text-slate-500' : active ? 'font-medium text-slate-900' : 'text-slate-400')}>{stage.label}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
