import { useState } from 'react';
import { ApiError } from '../../api/client.js';
import { Button } from '../ui/Button.jsx';
import { TextField } from '../ui/Field.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Alert } from '../ui/States.jsx';

/** Choose which page to audit (homepage by default) and start the audit. */
export function RunAuditModal({ project, open, onClose, onStart }) {
  const [url, setUrl] = useState(`https://${project.domain}/`);
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStarting(true);
    setError('');
    setFieldError('');
    try {
      await onStart(url.trim());
    } catch (err) {
      const field = err instanceof ApiError ? err.fieldErrors.url : null;
      if (field) setFieldError(field);
      else setError(err.message);
      setStarting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Run an AEO audit" description="Checks crawler access, structured data, content, trust signals and technical basics for one page.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Alert>{error}</Alert>
        <TextField
          label="Page to audit"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          error={fieldError}
          hint={`Any page on ${project.domain}. Full-site crawls arrive in the next phase.`}
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={starting}>
            Cancel
          </Button>
          <Button type="submit" loading={starting}>
            Start audit
          </Button>
        </div>
      </form>
    </Modal>
  );
}
