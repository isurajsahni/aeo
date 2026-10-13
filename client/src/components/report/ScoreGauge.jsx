import { toneFor } from '../../lib/score.js';

/** Semicircle-free ring gauge (0-100). Pure SVG so it prints cleanly in PDF exports later. */
export function ScoreGauge({ score, grade, size = 168, label = 'AEO score' }) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // A 270° arc, open at the bottom.
  const arc = circumference * 0.75;
  const value = Math.max(0, Math.min(100, score ?? 0));
  const tone = toneFor(score);

  return (
    <div className="relative inline-flex" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${score} out of 100, grade ${grade}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[135deg]">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${arc} ${circumference}`} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(arc * value) / 100} ${circumference}`}
          style={{ transition: 'stroke-dasharray 800ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-5xl font-bold tracking-tight ${tone.text}`}>{score ?? '–'}</span>
        <span className="mt-0.5 text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</span>
        {grade && <span className={`mt-1 rounded-md px-2 py-0.5 text-sm font-bold ring-1 ring-inset ${tone.soft}`}>Grade {grade}</span>}
      </div>
    </div>
  );
}

/** Horizontal bar for category scores. */
export function ScoreBar({ score }) {
  const tone = toneFor(score);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
      <div className={`h-full rounded-full ${tone.bg}`} style={{ width: `${score ?? 0}%`, transition: 'width 600ms ease-out' }} />
    </div>
  );
}
