import { AlertTriangle, CheckCircle2, Clock, Loader2, MinusCircle, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { BUCKET_LABELS, toneFor } from '../../lib/score.js';

const pill = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset';

const AUDIT_STATUS = {
  queued: { label: 'Queued', icon: Clock, className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  running: { label: 'Running', icon: Loader2, className: 'bg-brand-50 text-brand-700 ring-brand-200', spin: true },
  completed: { label: 'Completed', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  failed: { label: 'Failed', icon: XCircle, className: 'bg-red-50 text-red-700 ring-red-200' },
};

export function AuditStatusBadge({ status }) {
  const meta = AUDIT_STATUS[status] ?? AUDIT_STATUS.queued;
  const Icon = meta.icon;
  return (
    <span className={cn(pill, meta.className)}>
      <Icon className={cn('size-3', meta.spin && 'animate-spin')} />
      {meta.label}
    </span>
  );
}

const CHECK_STATUS = {
  pass: { icon: CheckCircle2, className: 'text-emerald-500', label: 'Pass' },
  warn: { icon: AlertTriangle, className: 'text-amber-500', label: 'Needs work' },
  fail: { icon: XCircle, className: 'text-red-500', label: 'Fail' },
  skipped: { icon: MinusCircle, className: 'text-slate-300', label: 'Not applicable' },
};

export function CheckStatusIcon({ check, className }) {
  const meta = CHECK_STATUS[check.skipped ? 'skipped' : check.status];
  const Icon = meta.icon;
  return <Icon className={cn('size-5 shrink-0', meta.className, className)} aria-label={meta.label} />;
}

export function GradeBadge({ grade, score, size = 'md' }) {
  if (!grade) return null;
  const tone = toneFor(score);
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-bold ring-1 ring-inset',
        tone.soft,
        size === 'sm' ? 'size-7 text-sm' : 'size-9 text-base',
      )}
      title={`Grade ${grade}`}
    >
      {grade}
    </span>
  );
}

const LEVEL_CLASS = {
  high: 'bg-rose-50 text-rose-700 ring-rose-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  low: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function LevelPill({ label, level }) {
  return (
    <span className={cn(pill, LEVEL_CLASS[level])}>
      {label}: {level}
    </span>
  );
}

const BUCKET_CLASS = {
  'quick-win': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'major-project': 'bg-brand-50 text-brand-700 ring-brand-200',
  'fill-in': 'bg-slate-100 text-slate-600 ring-slate-200',
  deprioritize: 'bg-slate-50 text-slate-500 ring-slate-200',
};

export function BucketPill({ bucket }) {
  return <span className={cn(pill, BUCKET_CLASS[bucket])}>{BUCKET_LABELS[bucket] ?? bucket}</span>;
}
