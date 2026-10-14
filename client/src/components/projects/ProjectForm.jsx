import { useState } from 'react';
import { ApiError } from '../../api/client.js';
import { Button } from '../ui/Button.jsx';
import { TextAreaField, TextField } from '../ui/Field.jsx';
import { Alert } from '../ui/States.jsx';
import { TagInput } from '../ui/TagInput.jsx';

const MAX_COMPETITORS = 10;
const EMPTY = { name: '', domain: '', competitors: [], brandTerms: [], notes: '' };

/** Create/edit form. `onSubmit(values)` should return a promise; API field errors are shown inline. */
export function ProjectForm({ initialValues, onSubmit, onCancel, submitLabel = 'Save project' }) {
  // Only the editable fields, so a PATCH never echoes back id/timestamps.
  const [values, setValues] = useState(() =>
    Object.fromEntries(Object.keys(EMPTY).map((key) => [key, initialValues?.[key] ?? EMPTY[key]])),
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setField = (field) => (eventOrValue) => {
    const value = eventOrValue?.target ? eventOrValue.target.value : eventOrValue;
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const clientErrors = {};
    if (!values.name.trim()) clientErrors.name = 'Name is required';
    if (!values.domain.trim()) clientErrors.domain = 'Domain is required';
    if (Object.keys(clientErrors).length) return setErrors(clientErrors);

    setSubmitting(true);
    setFormError('');
    try {
      await onSubmit({ ...values, name: values.name.trim(), domain: values.domain.trim() });
    } catch (err) {
      const fieldErrors = err instanceof ApiError ? err.fieldErrors : {};
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length || err.code === 'DUPLICATE_DOMAIN') setFormError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Alert>{formError}</Alert>

      <TextField
        label="Project name"
        placeholder="Smile Dental Clinic"
        value={values.name}
        onChange={setField('name')}
        error={errors.name}
        maxLength={100}
        required
      />
      <TextField
        label="Website domain"
        placeholder="smiledental.com"
        hint="A domain or full URL. We'll store just the hostname."
        value={values.domain}
        onChange={setField('domain')}
        error={errors.domain}
        inputMode="url"
        autoCapitalize="none"
        spellCheck={false}
        required
      />
      <TagInput
        label="Competitors (optional)"
        placeholder="rival.com, press Enter"
        hint={`Up to ${MAX_COMPETITORS} competitor domains to compare against.`}
        value={values.competitors}
        onChange={setField('competitors')}
        error={errors.competitors}
        max={MAX_COMPETITORS}
      />
      <TagInput
        label="Other brand names (optional)"
        placeholder="Smile Dental Clinic, press Enter"
        hint="Names AI assistants might use for this business. The project name and domain are always matched."
        value={values.brandTerms}
        onChange={setField('brandTerms')}
        error={errors.brandTerms}
        max={10}
        splitOnSpaces={false}
        lowercase={false}
      />
      <TextAreaField
        label="Notes (optional)"
        placeholder="Client contact, goals, target locations…"
        value={values.notes}
        onChange={setField('notes')}
        error={errors.notes}
        maxLength={2000}
      />

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
