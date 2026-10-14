import { ArrowLeft, Loader2, Play, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { projectsApi, promptsApi, visibilityApi } from '../api/endpoints.js';
import { PromptManager } from '../components/visibility/PromptManager.jsx';
import { RunVisibilityModal } from '../components/visibility/RunVisibilityModal.jsx';
import { VisibilityResults } from '../components/visibility/VisibilityResults.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Alert, EmptyState, ErrorState, PageLoader } from '../components/ui/States.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { formatRelative } from '../lib/format.js';

const POLL_MS = 2500;
const isActive = (run) => run?.status === 'queued' || run?.status === 'running';

/** Live progress for a running test; calls onDone when it finishes. */
function RunProgress({ run, onDone }) {
  const [status, setStatus] = useState(run);
  useEffect(() => {
    let timer;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const { run: next } = await visibilityApi.status(run.id, { signal: controller.signal });
        setStatus((prev) => ({ ...prev, ...next }));
        if (isActive(next)) timer = setTimeout(poll, POLL_MS);
        else onDone();
      } catch (err) {
        if (err.name !== 'AbortError') timer = setTimeout(poll, POLL_MS * 2);
      }
    };
    timer = setTimeout(poll, POLL_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [run.id, onDone]);

  const { done = 0, total = 0, message } = status.progress ?? {};
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <Loader2 className="size-5 shrink-0 animate-spin text-brand-600" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">{status.status === 'queued' ? 'Waiting to start…' : `Asking AI assistants: ${done} of ${total} answers`}</p>
          <p className="truncate text-xs text-slate-500">{message}</p>
        </div>
        <span className="text-sm font-semibold text-slate-700 tabular-nums">{percent}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-brand-600 transition-all duration-700" style={{ width: `${Math.max(3, percent)}%` }} />
      </div>
    </Card>
  );
}

export default function VisibilityPage() {
  const { projectId } = useParams();
  const project = useAsync((signal) => projectsApi.get(projectId, { signal }), [projectId]);
  const prompts = useAsync((signal) => promptsApi.list(projectId, { signal }), [projectId]);
  const providers = useAsync((signal) => visibilityApi.providers({ signal }), []);
  const runs = useAsync((signal) => visibilityApi.listRuns(projectId, { signal }), [projectId]);
  const [selectedId, setSelectedId] = useState(null);
  const [starting, setStarting] = useState(false);

  const history = runs.data?.runs ?? [];
  const active = history.find(isActive);
  const completed = history.filter((r) => r.status === 'completed');
  const shownId = selectedId ?? completed[0]?.id;
  const shown = useAsync((signal) => (shownId ? visibilityApi.get(shownId, { signal }) : Promise.resolve(null)), [shownId]);
  const lastFailed = history[0]?.status === 'failed' ? history[0] : null;

  const activePrompts = (prompts.data?.prompts ?? []).filter((p) => p.active).length;
  const configured = providers.data?.providers ?? [];

  const start = async (options) => {
    await visibilityApi.start(projectId, options);
    setStarting(false);
    runs.reload();
  };

  if (project.loading && !project.data) return <PageLoader label="Loading…" />;
  if (project.error) return <ErrorState title="Couldn’t load this project" error={project.error} onRetry={project.reload} />;

  return (
    <div className="space-y-6">
      <Link to={`/projects/${projectId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Back to project
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">AI visibility</h1>
          <p className="mt-1 text-sm text-slate-500">
            How often {project.data.project.name} is mentioned and cited when people ask AI assistants.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {completed.length > 1 && (
            <select
              value={shownId ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-lg border-0 py-2 pr-8 pl-3 text-sm text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-brand-600"
              aria-label="Show results from"
            >
              {completed.map((r) => (
                <option key={r.id} value={r.id}>
                  {formatRelative(r.completedAt)} · {Math.round((r.summary?.totals?.mentionRate ?? 0) * 100)}% mentioned
                </option>
              ))}
            </select>
          )}
          <Button onClick={() => setStarting(true)} disabled={!activePrompts || !configured.length || Boolean(active)}>
            <Play className="size-4" /> Run test
          </Button>
        </div>
      </div>

      {providers.data && !configured.length && (
        <Alert>No AI assistants are configured on the server. Add OPENAI_API_KEY, ANTHROPIC_API_KEY, PERPLEXITY_API_KEY and/or GEMINI_API_KEY, then restart it.</Alert>
      )}
      {lastFailed && !active && <Alert>The last test failed: {lastFailed.error?.message}</Alert>}

      {active && <RunProgress key={active.id} run={active} onDone={runs.reload} />}

      {shown.data?.run ? (
        <VisibilityResults run={shown.data.run} />
      ) : (
        !active &&
        !runs.loading && (
          <EmptyState
            icon={Sparkles}
            title="No visibility test yet"
            description="Add the prompts your client wants to rank for, then run a test. Each prompt is asked several times to each AI assistant, and you get a mention rate per assistant."
          />
        )
      )}

      <PromptManager projectId={projectId} prompts={prompts.data?.prompts ?? []} onChange={prompts.reload} />

      {starting && <RunVisibilityModal open onClose={() => setStarting(false)} onStart={start} providers={configured} activePrompts={activePrompts} />}
    </div>
  );
}
