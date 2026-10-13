import { ArrowLeft, Clock, ExternalLink, RotateCcw, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { auditsApi } from '../api/endpoints.js';
import { AuditProgress } from '../components/report/AuditProgress.jsx';
import { CategoryCards } from '../components/report/CategoryCards.jsx';
import { CheckList } from '../components/report/CheckList.jsx';
import { FixList } from '../components/report/FixList.jsx';
import { ScoreGauge } from '../components/report/ScoreGauge.jsx';
import { Button, buttonClasses } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Alert, EmptyState, ErrorState, PageLoader } from '../components/ui/States.jsx';
import { useAudit } from '../hooks/useAudit.js';
import { formatDate } from '../lib/format.js';
import { CATEGORY_ORDER, isAuditActive } from '../lib/score.js';

const formatDuration = (ms) => (ms == null ? null : ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`);

export default function AuditReportPage() {
  const { auditId } = useParams();
  const navigate = useNavigate();
  const { audit, error, loading } = useAudit(auditId);
  const [activeCategory, setActiveCategory] = useState(null);
  const [focusCheck, setFocusCheck] = useState(null);
  const [rerun, setRerun] = useState({ loading: false, error: '' });

  const categories = useMemo(
    () => [...(audit?.scores?.categories ?? [])].sort((a, b) => CATEGORY_ORDER.indexOf(a.id) - CATEGORY_ORDER.indexOf(b.id)),
    [audit?.scores?.categories],
  );
  const categoryNames = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  const projectId = audit?.project;

  const runAgain = async () => {
    setRerun({ loading: true, error: '' });
    try {
      const { audit: next } = await auditsApi.start(projectId, { url: audit.url });
      navigate(`/audits/${next.id}`);
      setRerun({ loading: false, error: '' });
    } catch (err) {
      setRerun({ loading: false, error: err.message });
    }
  };

  if (loading && !audit) return <PageLoader label="Loading audit…" />;
  if (error) {
    return error.status === 404 || error.status === 400 ? (
      <EmptyState
        title="Audit not found"
        description="It may have been deleted, or it belongs to another account."
        action={
          <Link to="/projects" className={buttonClasses({ variant: 'secondary' })}>
            Back to projects
          </Link>
        }
      />
    ) : (
      <ErrorState title="Couldn’t load this audit" error={error} onRetry={() => window.location.reload()} />
    );
  }

  const backLink = (
    <Link to={projectId ? `/projects/${projectId}` : '/projects'} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
      <ArrowLeft className="size-4" /> Back to project
    </Link>
  );

  if (isAuditActive(audit)) {
    return (
      <div className="space-y-6">
        {backLink}
        <AuditProgress audit={audit} />
      </div>
    );
  }

  if (audit.status === 'failed') {
    return (
      <div className="space-y-6">
        {backLink}
        <Card className="mx-auto max-w-xl p-6 text-center sm:p-8">
          <XCircle className="mx-auto size-10 text-red-500" />
          <h1 className="mt-3 text-lg font-semibold text-slate-900">The audit couldn’t finish</h1>
          <p className="mt-2 text-sm text-slate-600">{audit.error?.message ?? 'Something went wrong.'}</p>
          <p className="mt-1 text-xs break-all text-slate-400">{audit.url}</p>
          <div className="mt-6 space-y-3">
            <Alert>{rerun.error}</Alert>
            <Button onClick={runAgain} loading={rerun.loading}>
              <RotateCcw className="size-4" /> Try again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {backLink}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
          <ScoreGauge score={audit.scores.overall} grade={audit.scores.grade} />
          <div className="min-w-0 flex-1 text-center md:text-left">
            <h1 className="text-xl font-semibold text-slate-900">AEO readiness report</h1>
            <a
              href={audit.finalUrl ?? audit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex max-w-full items-center gap-1 text-sm break-all text-brand-600 hover:text-brand-700"
            >
              {audit.finalUrl ?? audit.url} <ExternalLink className="size-3.5 shrink-0" />
            </a>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{audit.summary}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500 md:justify-start">
              <span>Audited {formatDate(audit.completedAt)}</span>
              {audit.durationMs != null && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" /> {formatDuration(audit.durationMs)}
                </span>
              )}
              <span>{audit.checks.length} checks</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button variant="secondary" onClick={runAgain} loading={rerun.loading}>
              <RotateCcw className="size-4" /> Re-run audit
            </Button>
            {rerun.error && <p className="max-w-48 text-center text-xs text-red-600">{rerun.error}</p>}
          </div>
        </div>
      </Card>

      <CategoryCards categories={categories} activeCategory={activeCategory} onSelect={setActiveCategory} />

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <FixList
            fixes={audit.fixes}
            categoryNames={categoryNames}
            onJumpToCheck={(id) => {
              setActiveCategory(null);
              // A new object each click so jumping to the same check twice still scrolls.
              setFocusCheck({ id });
            }}
          />
        </div>
        <div className="xl:col-span-3">
          <CheckList checks={audit.checks} categories={categories} activeCategory={activeCategory} focusCheck={focusCheck} />
        </div>
      </div>
    </div>
  );
}
