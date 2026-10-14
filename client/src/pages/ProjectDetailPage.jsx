import { ArrowLeft, ChevronRight, ExternalLink, GitCompareArrows, Pencil, Play, Sparkles, Trash2 } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { auditsApi, projectsApi, visibilityApi } from '../api/endpoints.js';
import { AuditHistory } from '../components/projects/AuditHistory.jsx';
import { DeleteProjectModal } from '../components/projects/DeleteProjectModal.jsx';
import { ProjectForm } from '../components/projects/ProjectForm.jsx';
import { RunAuditModal } from '../components/projects/RunAuditModal.jsx';
import { Button, buttonClasses } from '../components/ui/Button.jsx';
import { Card, CardHeader } from '../components/ui/Card.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/States.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { formatDate } from '../lib/format.js';

// Recharts is large and only needed here, so load the chart on demand.
const ScoreTrend = lazy(() => import('../components/history/ScoreTrend.jsx').then((m) => ({ default: m.ScoreTrend })));

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [runningAudit, setRunningAudit] = useState(false);
  const { data, error, loading, reload, setData } = useAsync((signal) => projectsApi.get(projectId, { signal }), [projectId]);
  const audits = useAsync((signal) => auditsApi.listForProject(projectId, { signal }), [projectId]);
  const visibilityRuns = useAsync((signal) => visibilityApi.listRuns(projectId, { signal }), [projectId]);
  const latestVisibility = visibilityRuns.data?.runs?.find((r) => r.status === 'completed');
  const project = data?.project;

  if (loading && !project) return <PageLoader label="Loading project…" />;

  if (error) {
    const notFound = error.status === 404 || error.status === 400;
    return (
      <div className="space-y-6">
        <BackLink />
        {notFound ? (
          <EmptyState
            title="Project not found"
            description="It may have been deleted, or you don’t have access to it."
            action={
              <Link to="/projects" className={buttonClasses({ variant: 'secondary' })}>
                Back to projects
              </Link>
            }
          />
        ) : (
          <ErrorState title="Couldn’t load this project" error={error} onRetry={reload} />
        )}
      </div>
    );
  }

  const handleUpdate = async (values) => {
    const { project: updated } = await projectsApi.update(project.id, values);
    setData({ project: updated });
    setEditing(false);
  };

  const completedCount = (audits.data?.audits ?? []).filter((a) => a.status === 'completed').length;

  const handleStartAudit = async (options) => {
    try {
      const { audit } = await auditsApi.start(project.id, options);
      navigate(`/audits/${audit.id}`);
    } catch (err) {
      // An audit is already running: take the user to it instead of showing an error.
      const runningId = err.code === 'AUDIT_IN_PROGRESS' ? err.details?.[0]?.message : null;
      if (runningId) return navigate(`/audits/${runningId}`);
      throw err;
    }
  };

  const handleDelete = async () => {
    await projectsApi.remove(project.id);
    navigate('/projects', { replace: true });
  };

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-words text-slate-900">{project.name}</h1>
          <a
            href={`https://${project.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
          >
            {project.domain} <ExternalLink className="size-3.5" />
          </a>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
          <Button variant="ghost" onClick={() => setDeleting(true)} aria-label="Delete project" className="text-red-600 hover:bg-red-50 hover:text-red-700">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Audits"
            description="AEO readiness scores for this website over time."
            action={
              <div className="flex gap-2">
                {completedCount >= 2 && (
                  <Link to={`/projects/${project.id}/compare`} className={buttonClasses({ variant: 'secondary' })}>
                    <GitCompareArrows className="size-4" /> Compare
                  </Link>
                )}
                <Button onClick={() => setRunningAudit(true)}>
                  <Play className="size-4" /> Run audit
                </Button>
              </div>
            }
          />
          {completedCount >= 2 && (
            <div className="border-b border-slate-100">
              <Suspense fallback={<div className="m-5 h-56 animate-pulse rounded-lg bg-slate-100" />}>
                <ScoreTrend audits={audits.data.audits} />
              </Suspense>
            </div>
          )}
          <AuditHistory
            audits={audits.data?.audits}
            loading={audits.loading}
            error={audits.error}
            onRetry={audits.reload}
            emptyAction={
              <Button onClick={() => setRunningAudit(true)}>
                <Play className="size-4" /> Run your first audit
              </Button>
            }
          />
        </Card>

        <div className="space-y-6">
        <Link to={`/projects/${project.id}/visibility`} className="group block rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-brand-200">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">AI visibility</p>
              <p className="text-xs text-slate-500">
                {latestVisibility
                  ? `Mentioned in ${Math.round(latestVisibility.summary.totals.mentionRate * 100)}% of AI answers`
                  : 'Test how often ChatGPT, Claude, Perplexity and Gemini mention this business'}
              </p>
            </div>
            <ChevronRight className="size-4 text-slate-300 group-hover:text-brand-600" />
          </div>
        </Link>
        <Card>
          <CardHeader title="Details" />
          <dl className="divide-y divide-slate-100 text-sm">
            <DetailRow label="Competitors">
              {project.competitors.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {project.competitors.map((domain) => (
                    <li key={domain} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {domain}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-slate-400">None added</span>
              )}
            </DetailRow>
            <DetailRow label="Notes">
              {project.notes ? (
                <p className="whitespace-pre-line text-slate-700">{project.notes}</p>
              ) : (
                <span className="text-slate-400">No notes</span>
              )}
            </DetailRow>
            <DetailRow label="Created">{formatDate(project.createdAt)}</DetailRow>
            <DetailRow label="Last updated">{formatDate(project.updatedAt)}</DetailRow>
          </dl>
        </Card>
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit project">
        <ProjectForm initialValues={project} onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
      </Modal>

      {runningAudit && <RunAuditModal project={project} open onClose={() => setRunningAudit(false)} onStart={handleStartAudit} />}

      <DeleteProjectModal project={project} open={deleting} onClose={() => setDeleting(false)} onConfirm={handleDelete} />
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
      <ArrowLeft className="size-4" /> All projects
    </Link>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="px-5 py-3">
      <dt className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="text-slate-900">{children}</dd>
    </div>
  );
}
