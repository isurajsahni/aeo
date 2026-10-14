import { AlertTriangle, ChevronDown, ExternalLink, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { auditsApi } from '../../api/endpoints.js';
import { useAsync } from '../../hooks/useAsync.js';
import { cn } from '../../lib/cn.js';
import { toneFor } from '../../lib/score.js';
import { Card, CardHeader } from '../ui/Card.jsx';
import { ErrorState, PageLoader } from '../ui/States.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import { CheckStatusIcon, GradeBadge } from './Badges.jsx';

const pathOf = (url) => {
  try {
    const { pathname, search } = new URL(url);
    return `${pathname}${search}`;
  } catch {
    return url;
  }
};

/** The failing and warning checks for one page, loaded when its row is opened. */
function PageIssues({ auditId, pageId }) {
  const { data, error, loading } = useAsync((signal) => auditsApi.page(auditId, pageId, { signal }), [auditId, pageId]);
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-5 py-4 text-sm text-slate-500">
        <Spinner className="size-4" /> Loading checks…
      </div>
    );
  }
  if (error) return <p className="px-5 py-4 text-sm text-red-600">{error.message}</p>;

  const issues = data.page.checks.filter((c) => !c.skipped && c.status !== 'pass').sort((a, b) => a.score - b.score);
  if (!issues.length) return <p className="px-5 py-4 text-sm text-emerald-700">Every applicable check passes on this page.</p>;

  return (
    <ul className="divide-y divide-slate-100 bg-slate-50/60">
      {issues.map((check) => (
        <li key={check.id} className="flex gap-3 px-5 py-3">
          <CheckStatusIcon check={check} className="mt-0.5 size-4" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-slate-900">
              {check.title} <span className={cn('ml-1 tabular-nums', toneFor(check.score).text)}>{check.score}</span>
            </p>
            <p className="text-slate-600">{check.details?.summary}</p>
            {check.recommendation && (
              <p className="mt-1 flex gap-1.5 text-xs text-brand-800">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-brand-600" /> {check.recommendation}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Page-level results for a site crawl: worst pages first, expandable. */
export function PagesTable({ auditId, crawlStats }) {
  const { data, error, loading, reload } = useAsync((signal) => auditsApi.pages(auditId, { signal }), [auditId]);
  const [openId, setOpenId] = useState(null);
  const [onlyIssues, setOnlyIssues] = useState(false);

  const pages = data?.pages ?? [];
  const visible = onlyIssues ? pages.filter((p) => p.error || p.issues?.fail > 0) : pages;
  const extra = [crawlStats?.failed && `${crawlStats.failed} could not be loaded`, crawlStats?.skippedByRobots && `${crawlStats.skippedByRobots} skipped by robots.txt`].filter(Boolean);

  return (
    <Card>
      <CardHeader
        title={`Pages (${pages.length})`}
        description={`Worst pages first. Click a page to see its issues.${extra.length ? ` ${extra.join(', ')}.` : ''}`}
        action={
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} className="rounded border-slate-300 text-brand-600 focus:ring-brand-600" />
            Only pages with failures
          </label>
        }
      />
      {loading && !data ? (
        <PageLoader label="Loading pages…" />
      ) : error ? (
        <ErrorState title="Couldn’t load pages" error={error} onRetry={reload} className="m-5" />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-2">Page</th>
                <th scope="col" className="px-3 py-2 text-right">Score</th>
                <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">Failing</th>
                <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell">Warnings</th>
                <th scope="col" className="hidden px-3 py-2 text-right md:table-cell">Words</th>
                <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">Expand</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((page) => {
                const open = openId === page.id;
                return (
                  <PageRow key={page.id} page={page} open={open} onToggle={() => setOpenId(open ? null : page.id)} auditId={auditId} />
                );
              })}
            </tbody>
          </table>
          {!visible.length && <p className="px-5 py-8 text-center text-sm text-slate-500">No pages match this filter.</p>}
        </div>
      )}
    </Card>
  );
}

function PageRow({ page, open, onToggle, auditId }) {
  if (page.error) {
    return (
      <tr className="bg-red-50/40">
        <td className="px-5 py-3" colSpan={6}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-red-500" />
            <span className="truncate font-medium text-slate-900">{pathOf(page.url)}</span>
            <span className="truncate text-xs text-red-700">{page.error.message}</span>
          </div>
        </td>
      </tr>
    );
  }
  return (
    <>
      <tr className={cn('cursor-pointer hover:bg-slate-50', open && 'bg-slate-50')} onClick={onToggle} aria-expanded={open}>
        <td className="max-w-xs px-5 py-3">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-slate-900">{pathOf(page.url)}</span>
            <a href={page.finalUrl ?? page.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 text-slate-400 hover:text-brand-600" aria-label="Open page">
              <ExternalLink className="size-3.5" />
            </a>
          </div>
          {page.title && <p className="truncate text-xs text-slate-500">{page.title}</p>}
        </td>
        <td className="px-3 py-3">
          <span className="flex items-center justify-end gap-2">
            <span className="font-semibold text-slate-900 tabular-nums">{page.score}</span>
            <GradeBadge grade={page.grade} score={page.score} size="sm" />
          </span>
        </td>
        <td className={cn('hidden px-3 py-3 text-right tabular-nums sm:table-cell', page.issues?.fail ? 'font-medium text-red-600' : 'text-slate-400')}>{page.issues?.fail ?? 0}</td>
        <td className={cn('hidden px-3 py-3 text-right tabular-nums sm:table-cell', page.issues?.warn ? 'text-amber-600' : 'text-slate-400')}>{page.issues?.warn ?? 0}</td>
        <td className="hidden px-3 py-3 text-right text-slate-500 tabular-nums md:table-cell">{page.wordCount?.toLocaleString() ?? '—'}</td>
        <td className="px-3 py-3">
          <ChevronDown className={cn('size-4 text-slate-400 transition-transform', open && 'rotate-180')} />
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="p-0">
            <PageIssues auditId={auditId} pageId={page.id} />
          </td>
        </tr>
      )}
    </>
  );
}
