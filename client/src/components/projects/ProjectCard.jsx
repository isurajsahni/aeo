import { ChevronRight, Globe, Users } from 'lucide-react';
import { Link } from 'react-router';
import { formatRelative } from '../../lib/format.js';
import { GradeBadge } from '../report/Badges.jsx';

export function ProjectCard({ project }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="group flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-brand-200 focus-visible:outline-2 focus-visible:outline-brand-600"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 font-semibold text-slate-900">{project.name}</h3>
        {project.lastAudit ? (
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-lg font-semibold text-slate-900 tabular-nums">{project.lastAudit.score}</span>
            <GradeBadge grade={project.lastAudit.grade} score={project.lastAudit.score} size="sm" />
          </span>
        ) : (
          <ChevronRight className="size-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
        )}
      </div>

      <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-slate-500">
        <Globe className="size-3.5 shrink-0" />
        <span className="truncate">{project.domain}</span>
      </p>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Users className="size-3.5" />
          {project.competitors.length} competitor{project.competitors.length === 1 ? '' : 's'}
        </span>
        <span>{project.lastAudit ? `Audited ${formatRelative(project.lastAudit.completedAt)}` : 'Not audited yet'}</span>
      </div>
    </Link>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200" aria-hidden="true">
      <div className="h-4 w-2/3 rounded bg-slate-200" />
      <div className="mt-3 h-3 w-1/2 rounded bg-slate-100" />
      <div className="mt-8 h-3 w-full rounded bg-slate-100" />
    </div>
  );
}
