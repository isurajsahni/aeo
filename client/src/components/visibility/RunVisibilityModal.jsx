import { useState } from 'react';
import { cn } from '../../lib/cn.js';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Alert } from '../ui/States.jsx';

/** Pick assistants and repeats; shows exactly how many AI requests the test will make. */
export function RunVisibilityModal({ open, onClose, onStart, providers, activePrompts }) {
  const [selected, setSelected] = useState(() => providers.map((p) => p.id));
  const [runsPerPrompt, setRunsPerPrompt] = useState(3);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  const calls = activePrompts * selected.length * runsPerPrompt;
  const toggle = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const start = async () => {
    setStarting(true);
    setError('');
    try {
      await onStart({ providers: selected, runsPerPrompt });
    } catch (err) {
      setError(err.message);
      setStarting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Run an AI visibility test" description="Each active prompt is asked to each assistant several times, because AI answers vary.">
      <div className="space-y-5">
        <Alert>{error}</Alert>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">AI assistants</legend>
          <div className="grid grid-cols-2 gap-2">
            {providers.map((p) => (
              <label key={p.id} className={cn('flex cursor-pointer items-start gap-2 rounded-lg p-3 ring-1', selected.includes(p.id) ? 'bg-brand-50 ring-brand-600' : 'ring-slate-300 hover:bg-slate-50')}>
                <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-600" />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{p.label}</span>
                  <span className="block text-xs text-slate-500">{p.model}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Times to ask each prompt</legend>
          <div className="flex rounded-lg bg-slate-100 p-0.5" role="radiogroup">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={runsPerPrompt === n}
                onClick={() => setRunsPerPrompt(n)}
                className={cn('flex-1 rounded-md py-1.5 text-sm font-medium', runsPerPrompt === n ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900')}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">3 is a good default: enough to see how often you appear, not just whether you did once.</p>
        </fieldset>

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
          This makes <strong className="tabular-nums">{calls}</strong> AI requests ({activePrompts} prompts × {selected.length} assistants × {runsPerPrompt}). Each uses web search and is billed to your API keys.
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={starting}>
            Cancel
          </Button>
          <Button onClick={start} loading={starting} disabled={!selected.length || !activePrompts}>
            Start test
          </Button>
        </div>
      </div>
    </Modal>
  );
}
