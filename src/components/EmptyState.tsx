import type { ReactNode } from 'react';

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto mt-16 max-w-xl rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <div className="mt-2 text-sm text-slate-600">{children}</div>
    </div>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-6 text-2xl font-semibold text-slate-900">{children}</h1>;
}
