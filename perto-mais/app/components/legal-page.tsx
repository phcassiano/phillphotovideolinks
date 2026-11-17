import { TriangleAlert } from 'lucide-react';

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="container-page max-w-3xl pt-8">
      <h1 className="text-3xl font-black tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-ink-muted">Última atualização: {updated}</p>
      <p className="mt-4 flex gap-2 rounded-2xl bg-warning-50 p-4 text-sm text-warning">
        <TriangleAlert aria-hidden className="size-5 shrink-0" />
        Rascunho — este texto ainda precisa de revisão jurídica antes do lançamento.
      </p>
      <div className="mt-6 space-y-4 leading-relaxed text-ink [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-ink-muted [&_li]:text-ink-muted">
        {children}
      </div>
    </div>
  );
}
