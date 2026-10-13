import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { Button } from './Button.jsx';
import { Spinner } from './Spinner.jsx';

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500" role="status">
      <Spinner className="size-6 text-brand-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center', className)}>
      {Icon && (
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Icon className="size-6" />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', error, onRetry, className }) {
  return (
    <div className={cn('rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center', className)} role="alert">
      <AlertTriangle className="mx-auto mb-3 size-8 text-red-500" />
      <h3 className="text-base font-semibold text-red-900">{title}</h3>
      {error?.message && <p className="mx-auto mt-1 max-w-md text-sm text-red-700">{error.message}</p>}
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Inline banner for form-level errors. */
export function Alert({ children }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-red-200" role="alert">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
