import { X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/cn.js';
import { Field } from './Field.jsx';

/**
 * A list-of-strings input: type a value and press Enter or comma to add it.
 * Pasting a separated list adds every entry. Domains split on spaces too and are
 * lowercased; free text (brand names) passes splitOnSpaces={false} lowercase={false}.
 */
export function TagInput({ label, hint, error, value, onChange, placeholder, max, splitOnSpaces = true, lowercase = true }) {
  const [draft, setDraft] = useState('');
  const atLimit = max != null && value.length >= max;

  const addTags = (raw) => {
    const incoming = raw
      .split(splitOnSpaces ? /[\s,]+/ : /[,\n]+/)
      .map((tag) => (lowercase ? tag.trim().toLowerCase() : tag.trim()))
      .filter(Boolean);
    if (!incoming.length) return;

    const next = [...value];
    for (const tag of incoming) {
      if (!next.includes(tag) && (max == null || next.length < max)) next.push(tag);
    }
    onChange(next);
    setDraft('');
  };

  const removeTag = (tag) => onChange(value.filter((t) => t !== tag));

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTags(draft);
    } else if (event.key === 'Backspace' && !draft && value.length) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <Field label={label} hint={hint} error={error}>
      {({ className, ...controlProps }) => (
        <div className={cn(className, 'flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-brand-600')}>
          {value.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-slate-100 py-0.5 pr-1 pl-2 text-xs font-medium text-slate-700">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                aria-label={`Remove ${tag}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            {...controlProps}
            value={draft}
            disabled={atLimit}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => addTags(draft)}
            onPaste={(e) => {
              e.preventDefault();
              addTags(`${draft}${splitOnSpaces ? ' ' : ','}${e.clipboardData.getData('text')}`);
            }}
            placeholder={atLimit ? `Limit of ${max} reached` : placeholder}
            className="min-w-32 flex-1 border-0 bg-transparent p-0.5 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
          />
        </div>
      )}
    </Field>
  );
}
