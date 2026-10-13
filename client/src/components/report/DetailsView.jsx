/**
 * Generic renderer for a check's `details` object, so new checks need no UI work:
 *  - `summary` is rendered as the lead sentence (by the parent)
 *  - primitives become label/value rows
 *  - arrays of primitives become chip lists
 *  - arrays of objects become small tables
 *  - plain objects become nested label/value rows
 */

const humanize = (key) =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());

function formatValue(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value == null || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
}

const isUrl = (value) => typeof value === 'string' && /^https?:\/\//.test(value);

function Value({ value }) {
  if (isUrl(value)) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="break-all text-brand-600 hover:underline">
        {value}
      </a>
    );
  }
  return <span className="break-words">{formatValue(value)}</span>;
}

function Table({ rows }) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-xs">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th key={col} scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap text-slate-600">
                {humanize(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col} className="max-w-xs px-3 py-2 align-top text-slate-700">
                  {typeof row[col] === 'object' && row[col] !== null ? JSON.stringify(row[col]) : <Value value={row[col]} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Entry({ label, value }) {
  if (Array.isArray(value)) {
    if (!value.length) return null;
    if (value.every((v) => v !== null && typeof v === 'object')) {
      return (
        <div className="space-y-1.5">
          <dt className="text-xs font-medium text-slate-500">{label}</dt>
          <dd>
            <Table rows={value} />
          </dd>
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        <dt className="text-xs font-medium text-slate-500">{label}</dt>
        <dd className="flex flex-wrap gap-1.5">
          {value.map((item, i) => (
            <span key={i} className="max-w-full rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs break-all whitespace-pre-wrap text-slate-700">
              {formatValue(item)}
            </span>
          ))}
        </dd>
      </div>
    );
  }
  if (value !== null && typeof value === 'object') {
    return (
      <div className="space-y-1.5">
        <dt className="text-xs font-medium text-slate-500">{label}</dt>
        <dd className="rounded-lg bg-slate-50 p-3">
          <DetailsView details={value} />
        </dd>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_1fr] gap-3 text-sm">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-xs text-slate-800">
        <Value value={value} />
      </dd>
    </div>
  );
}

export function DetailsView({ details }) {
  const entries = Object.entries(details ?? {}).filter(([key]) => key !== 'summary');
  if (!entries.length) return null;
  return (
    <dl className="space-y-3">
      {entries.map(([key, value]) => (
        <Entry key={key} label={humanize(key)} value={value} />
      ))}
    </dl>
  );
}
