import { FileText, Network } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../api/client.js';
import { useAuthConfig } from '../../hooks/useAuthConfig.js';
import { cn } from '../../lib/cn.js';
import { Button } from '../ui/Button.jsx';
import { TextField } from '../ui/Field.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Alert } from '../ui/States.jsx';

const MODES = [
  { id: 'single', label: 'Single page', icon: FileText, hint: 'Fast: one page, every check.' },
  { id: 'site', label: 'Whole site', icon: Network, hint: 'Crawls linked and sitemap pages.' },
];

/** Choose single page or site crawl, the start URL, and the page limit. */
export function RunAuditModal({ project, open, onClose, onStart }) {
  const { crawl } = useAuthConfig();
  const [mode, setMode] = useState('single');
  const [url, setUrl] = useState(`https://${project.domain}/`);
  const [maxPages, setMaxPages] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  const pages = maxPages === '' ? crawl.defaultPages : Number(maxPages);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStarting(true);
    setError('');
    setFieldErrors({});
    try {
      await onStart(mode === 'site' ? { url: url.trim(), mode, maxPages: pages } : { url: url.trim(), mode });
    } catch (err) {
      const fields = err instanceof ApiError ? err.fieldErrors : {};
      setFieldErrors(fields);
      if (!Object.keys(fields).length) setError(err.message);
      setStarting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Run an AEO audit" description="Checks crawler access, structured data, content, trust signals and technical basics.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Alert>{error}</Alert>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">What to audit</legend>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map(({ id, label, icon: Icon, hint }) => (
              <label
                key={id}
                className={cn(
                  'flex cursor-pointer flex-col gap-1 rounded-lg p-3 ring-1 transition',
                  mode === id ? 'bg-brand-50 ring-2 ring-brand-600' : 'ring-slate-300 hover:bg-slate-50',
                )}
              >
                <input type="radio" name="mode" value={id} checked={mode === id} onChange={() => setMode(id)} className="sr-only" />
                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                  <Icon className="size-4 text-brand-600" /> {label}
                </span>
                <span className="text-xs text-slate-500">{hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <TextField
          label={mode === 'site' ? 'Start page' : 'Page to audit'}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          error={fieldErrors.url}
          hint={`Any page on ${project.domain}.`}
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
        />

        {mode === 'site' && (
          <TextField
            label="Maximum pages"
            type="number"
            min={2}
            max={crawl.maxPages}
            placeholder={String(crawl.defaultPages)}
            value={maxPages}
            onChange={(e) => setMaxPages(e.target.value)}
            error={fieldErrors.maxPages}
            hint={`2-${crawl.maxPages} pages. Roughly 5-10 seconds per page; you can leave the page while it runs.`}
          />
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={starting}>
            Cancel
          </Button>
          <Button type="submit" loading={starting}>
            {mode === 'site' ? `Crawl up to ${pages} pages` : 'Start audit'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
