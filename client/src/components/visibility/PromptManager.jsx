import { MapPin, MessageSquareText, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../api/client.js';
import { promptsApi } from '../../api/endpoints.js';
import { cn } from '../../lib/cn.js';
import { Button } from '../ui/Button.jsx';
import { Card, CardHeader } from '../ui/Card.jsx';
import { TextField } from '../ui/Field.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Alert, EmptyState } from '../ui/States.jsx';

const describeLocation = (loc) => [loc?.city, loc?.region, loc?.country].filter(Boolean).join(', ');

function PromptForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [text, setText] = useState(initial?.text ?? '');
  const [city, setCity] = useState(initial?.location?.city ?? '');
  const [country, setCountry] = useState(initial?.location?.country ?? '');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError('');
    try {
      await onSubmit({ text: text.trim(), location: city || country ? { city: city.trim(), country: country.trim() } : null });
    } catch (err) {
      const fields = err instanceof ApiError ? err.fieldErrors : {};
      // Nested location errors arrive as "location.country"; fieldErrors keys them as "location".
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Alert>{formError}</Alert>
      <TextField
        label="Prompt"
        placeholder="best dentist in Ludhiana"
        hint="Write it the way a customer would ask ChatGPT or Perplexity."
        value={text}
        onChange={(e) => setText(e.target.value)}
        error={errors.text}
        maxLength={500}
      />
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <TextField label="City (optional)" placeholder="Ludhiana" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <TextField label="Country" placeholder="IN" value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} error={errors.location} />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** The project's target prompts: add, edit, pause/resume, delete. */
export function PromptManager({ projectId, prompts, onChange }) {
  const [editing, setEditing] = useState(null); // null | 'new' | prompt
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const save = async (values) => {
    if (editing === 'new') await promptsApi.create(projectId, values);
    else await promptsApi.update(projectId, editing.id, values);
    setEditing(null);
    onChange();
  };

  const act = async (prompt, action) => {
    setBusyId(prompt.id);
    setError('');
    try {
      if (action === 'toggle') await promptsApi.update(projectId, prompt.id, { active: !prompt.active });
      if (action === 'delete') await promptsApi.remove(projectId, prompt.id);
      onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const active = prompts.filter((p) => p.active).length;

  return (
    <Card>
      <CardHeader
        title={`Target prompts (${active} active)`}
        description="Questions your client’s customers ask AI assistants. Paused prompts are skipped."
        action={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-4" /> Add prompt
          </Button>
        }
      />
      {error && <div className="px-5 pt-4"><Alert>{error}</Alert></div>}
      {prompts.length ? (
        <ul className="divide-y divide-slate-100">
          {prompts.map((prompt) => (
            <li key={prompt.id} className={cn('flex items-center gap-3 px-5 py-3', !prompt.active && 'opacity-60')}>
              <MessageSquareText className="size-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-900">{prompt.text}</p>
                {describeLocation(prompt.location) && (
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="size-3" /> {describeLocation(prompt.location)}
                  </p>
                )}
              </div>
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={prompt.active} disabled={busyId === prompt.id} onChange={() => act(prompt, 'toggle')} className="rounded border-slate-300 text-brand-600 focus:ring-brand-600" />
                Active
              </label>
              <button type="button" onClick={() => setEditing(prompt)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Edit "${prompt.text}"`}>
                <Pencil className="size-4" />
              </button>
              <button type="button" onClick={() => act(prompt, 'delete')} disabled={busyId === prompt.id} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete "${prompt.text}"`}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-5">
          <EmptyState
            icon={MessageSquareText}
            title="No prompts yet"
            description="Add 5-20 questions your client wants to be the answer to, e.g. “best dentist in Ludhiana” or “teeth whitening cost near me”."
            className="border-slate-200"
          />
        </div>
      )}

      <Modal open={editing != null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add a prompt' : 'Edit prompt'}>
        {editing != null && <PromptForm initial={editing === 'new' ? null : editing} onSubmit={save} onCancel={() => setEditing(null)} submitLabel={editing === 'new' ? 'Add prompt' : 'Save'} />}
      </Modal>
    </Card>
  );
}
