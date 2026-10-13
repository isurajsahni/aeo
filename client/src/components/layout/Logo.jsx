export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold text-slate-900">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-brand-600" />
        <path d="M9 22l7-13 7 13M11.8 17h8.4" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      AEO Audit
    </span>
  );
}
