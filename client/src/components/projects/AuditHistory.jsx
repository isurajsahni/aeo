import { ChevronRight, Gauge } from 'lucide-react';
import { Link } from 'react-router';
import { formatDate, formatRelative } from '../../lib/format.js';
import { AuditStatusBadge, GradeBadge } from '../report/Badges.jsx';
import { EmptyState, ErrorState } from '../ui/States.jsx';

const pathOf = (url) => {
  try {
    const { pathname, search } = new URL(url);
    return `${pathname}${search}`;
  } catch {
    return url;
  }
};

export function AuditHistory({ audits, loading, error, onRetry, emptyAction }) {
  if (loading && !audits) {
    return (
      <div className="space-y-2 p-5" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState title="Couldn’t load audits" error={error} onRetry={onRetry} className="m-5" />;
  if (!audits?.length) {
    return (
      <div className="p-5">
        <EmptyState
          icon={Gauge}
          title="No audits yet"
          description="Run an audit to score how well AI assistants can find, understand and cite this site."
          action={emptyAction}
          className="border-slate-200"
        />
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {audits.map((audit) => (
        <li key={audit.id}>
          <Link to={`/audits/${audit.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50">
            {audit.status === 'completed' ? (
              <GradeBadge grade={audit.scores?.grade} score={audit.scores?.overall} />
            ) : (
              <span className="size-9" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-900">
                <span className="truncate">{pathOf(audit.url)}</span>
                {audit.crawlConfig?.mode === 'site' && (
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    Site · {audit.status === 'completed' ? audit.pageCount : `up to ${audit.crawlConfig.maxPages}`} pages
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500" title={formatDate(audit.createdAt)}>
                {formatRelative(audit.createdAt)}
                {audit.status === 'failed' && audit.error?.message && <span className="text-red-600"> · {audit.error.message}</span>}
              </p>
            </div>
            {audit.status === 'completed' ? (
              <span className="text-lg font-semibold text-slate-900 tabular-nums">
                {audit.scores?.overall}
                <span className="text-xs font-normal text-slate-400">/100</span>
              </span>
            ) : (
              <AuditStatusBadge status={audit.status} />
            )}
            <ChevronRight className="size-4 shrink-0 text-slate-300" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
