import { useState } from 'react';
import { Button, inputClass } from '../../components/ui';
import type { StepRow } from '../../core/import';

const TYPES: [string, string][] = [
  ['taak', 'Taak'],
  ['beslissing', 'Beslissing'],
  ['start', 'Start'],
  ['einde', 'Einde'],
];

const empty = (): StepRow => ({
  name: '',
  type: 'taak',
  role: '',
  system: '',
  processingTime: '',
  waitingTime: '',
  next: '',
});

export function FormInput({ onSubmit }: { onSubmit: (rows: StepRow[]) => void }) {
  const [rows, setRows] = useState<StepRow[]>([empty(), empty(), empty()]);
  const set = (i: number, patch: Partial<StepRow>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Vul de stappen in volgorde in. Laat „Volgende” leeg om de stappen gewoon achter elkaar te zetten, of
        verwijs naar het nummer van een stap (bijvoorbeeld <code>s4</code>, of bij een beslissing{' '}
        <code>s4:ja;s6:nee</code>). Start en einde worden zo nodig toegevoegd.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-500">
            <th className="w-10 py-1">Nr</th>
            <th className="py-1 pr-2">Stap</th>
            <th className="w-32 py-1 pr-2">Type</th>
            <th className="py-1 pr-2">Rol</th>
            <th className="py-1 pr-2">Systeem</th>
            <th className="w-24 py-1 pr-2">Bewerktijd (min)</th>
            <th className="w-24 py-1 pr-2">Wachttijd (min)</th>
            <th className="py-1 pr-2">Volgende</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="py-1 text-xs text-slate-500">s{i + 1}</td>
              <td className="py-1 pr-2">
                <input
                  aria-label={`Stap ${i + 1}`}
                  value={row.name}
                  onChange={(e) => set(i, { name: e.target.value })}
                  className={inputClass}
                />
              </td>
              <td className="py-1 pr-2">
                <select
                  aria-label={`Type ${i + 1}`}
                  value={row.type}
                  onChange={(e) => set(i, { type: e.target.value })}
                  className={inputClass}
                >
                  {TYPES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-1 pr-2">
                <input
                  aria-label={`Rol ${i + 1}`}
                  value={row.role}
                  onChange={(e) => set(i, { role: e.target.value })}
                  className={inputClass}
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  aria-label={`Systeem ${i + 1}`}
                  value={row.system}
                  onChange={(e) => set(i, { system: e.target.value })}
                  className={inputClass}
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  aria-label={`Bewerktijd ${i + 1}`}
                  inputMode="decimal"
                  value={String(row.processingTime ?? '')}
                  onChange={(e) => set(i, { processingTime: e.target.value })}
                  className={inputClass}
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  aria-label={`Wachttijd ${i + 1}`}
                  inputMode="decimal"
                  value={String(row.waitingTime ?? '')}
                  onChange={(e) => set(i, { waitingTime: e.target.value })}
                  className={inputClass}
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  aria-label={`Volgende ${i + 1}`}
                  value={row.next}
                  onChange={(e) => set(i, { next: e.target.value })}
                  className={inputClass}
                />
              </td>
              <td>
                <Button
                  variant="ghost"
                  aria-label={`Rij ${i + 1} verwijderen`}
                  onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                >
                  ✕
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setRows((r) => [...r, empty()])}>
          Rij toevoegen
        </Button>
        <Button onClick={() => onSubmit(rows)}>Naar diagram</Button>
      </div>
    </div>
  );
}
