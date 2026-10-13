import { cn } from '../../lib/cn.js';

export function Card({ className, children }) {
  return <section className={cn('rounded-xl bg-white shadow-sm ring-1 ring-slate-200', className)}>{children}</section>;
}

export function CardHeader({ title, description, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
