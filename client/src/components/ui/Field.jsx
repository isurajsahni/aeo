import { useId } from 'react';
import { cn } from '../../lib/cn.js';

const controlClasses = (error) =>
  cn(
    'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset',
    'placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:outline-none',
    error ? 'ring-red-400 focus:ring-red-500' : 'ring-slate-300 focus:ring-brand-600',
  );

/** Label + control + hint/error, wired up for screen readers. */
export function Field({ label, hint, error, children, id }) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children({ id: fieldId, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, className: controlClasses(error) })}
      {error ? (
        <p id={`${fieldId}-error`} className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${fieldId}-hint`} className="mt-1.5 text-sm text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function TextField({ label, hint, error, id, ...inputProps }) {
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      {(controlProps) => <input {...controlProps} {...inputProps} />}
    </Field>
  );
}

export function TextAreaField({ label, hint, error, id, rows = 3, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      {(controlProps) => <textarea rows={rows} {...controlProps} {...props} />}
    </Field>
  );
}

export { controlClasses };
