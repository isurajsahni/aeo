import { cn } from '../../lib/cn.js';
import { Spinner } from './Spinner.jsx';

const VARIANTS = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 focus-visible:outline-brand-600',
  secondary: 'bg-white text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-brand-600',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:outline-red-600',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-brand-600',
};

const SIZES = {
  sm: 'gap-1.5 px-2.5 py-1.5 text-sm',
  md: 'gap-2 px-3.5 py-2 text-sm',
  lg: 'gap-2 px-4 py-2.5 text-base',
};

/** Shared class string so links (<Link>) can look like buttons. */
export const buttonClasses = ({ variant = 'primary', size = 'md', className } = {}) =>
  cn(
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    SIZES[size],
    className,
  );

export function Button({ variant, size, loading = false, disabled, className, children, type = 'button', ...props }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
