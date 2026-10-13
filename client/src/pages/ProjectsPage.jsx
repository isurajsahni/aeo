import { FolderPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { projectsApi } from '../api/endpoints.js';
import { ProjectCard, ProjectCardSkeleton } from '../components/projects/ProjectCard.jsx';
import { ProjectForm } from '../components/projects/ProjectForm.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { useAsync } from '../hooks/useAsync.js';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { data, error, loading, reload } = useAsync((signal) => projectsApi.list({ signal }), []);
  const projects = data?.projects ?? [];

  const handleCreate = async (values) => {
    const { project } = await projectsApi.create(values);
    navigate(`/projects/${project.id}`);
  };

  let content;
  if (loading && !data) {
    content = (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 3 }, (_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    );
  } else if (error) {
    content = <ErrorState title="Couldn’t load projects" error={error} onRetry={reload} />;
  } else if (!projects.length) {
    content = (
      <EmptyState
        icon={FolderPlus}
        title="No projects yet"
        description="Create a project for each client website you want to audit for AI search visibility."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Create your first project
          </Button>
        }
      />
    );
  } else {
    content = (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">One project per client website.</p>
        </div>
        {projects.length > 0 && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New project
          </Button>
        )}
      </div>

      {content}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New project"
        description="Add a client website and, optionally, the competitors you want to benchmark."
      >
        <ProjectForm onSubmit={handleCreate} onCancel={() => setCreating(false)} submitLabel="Create project" />
      </Modal>
    </>
  );
}
