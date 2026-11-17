import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { num, RecordDialog, SortableList, type FieldDef } from '~/components/admin/crud';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { useAdminMutation } from '~/features/admin/hooks';
import { formatBRL, parseBRL } from '~/lib/money';
import { useSupabase } from '~/lib/supabase/client';
import type { Database } from '~/types/database';

type Plan = Database['public']['Tables']['plans']['Row'];

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Nome' },
  { name: 'description', label: 'Descrição curta', optional: true },
  { name: 'price', label: 'Preço (R$)', hint: 'Use 0 para gratuito.' },
  { name: 'billing_interval', label: 'Cobrança', type: 'select', options: [{ value: 'none', label: 'Sem cobrança' }, { value: 'month', label: 'Mensal' }, { value: 'year', label: 'Anual' }] },
  { name: 'features', label: 'Itens exibidos na página de planos', hint: 'Separe por ponto e vírgula (;).', optional: true },
  { name: 'max_products', label: 'Máximo de produtos', type: 'number' },
  { name: 'max_photos', label: 'Máximo de fotos na galeria', type: 'number' },
  { name: 'can_logo', label: 'Logo', type: 'checkbox' },
  { name: 'can_cover', label: 'Capa', type: 'checkbox' },
  { name: 'can_description', label: 'Descrição completa', type: 'checkbox' },
  { name: 'can_instagram', label: 'Instagram', type: 'checkbox' },
  { name: 'can_gallery', label: 'Galeria', type: 'checkbox' },
  { name: 'can_products', label: 'Catálogo/cardápio', type: 'checkbox' },
  { name: 'can_detailed_stats', label: 'Estatísticas detalhadas', type: 'checkbox' },
  { name: 'highlight_in_listing', label: 'Destaque visual na listagem', type: 'checkbox' },
  { name: 'is_public', label: 'Aparece na página de planos', type: 'checkbox' },
  { name: 'is_active', label: 'Ativo', type: 'checkbox' },
];

export default function AdminPlanos() {
  const supabase = useSupabase();
  const q = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: async () => {
      const { data, error } = await supabase.from('plans').select('*').order('sort_order');
      if (error) throw error;
      return data;
    },
  });
  const [editing, setEditing] = React.useState<Plan | null>(null);
  const save = useAdminMutation(
    async ({ id, v }: { id: string; v: Record<string, string | boolean> }) => {
      const price = parseBRL(String(v.price));
      if (price === null) throw new Error('Preço inválido.');
      return supabase
        .from('plans')
        .update({
          name: String(v.name),
          description: String(v.description) || null,
          price_cents: price,
          billing_interval: String(v.billing_interval) as Plan['billing_interval'],
          features: String(v.features).split(';').map((s) => s.trim()).filter(Boolean),
          max_products: num(v.max_products) ?? 0,
          max_photos: num(v.max_photos) ?? 0,
          can_logo: !!v.can_logo,
          can_cover: !!v.can_cover,
          can_description: !!v.can_description,
          can_instagram: !!v.can_instagram,
          can_gallery: !!v.can_gallery,
          can_products: !!v.can_products,
          can_detailed_stats: !!v.can_detailed_stats,
          highlight_in_listing: !!v.highlight_in_listing,
          is_public: !!v.is_public,
          is_active: !!v.is_active,
        })
        .eq('id', id);
    },
    { success: 'Plano salvo.', invalidate: [['admin', 'plans']] },
  );
  if (q.isLoading) return <Skeleton className="h-64" />;
  if (q.isError || !q.data) return <Alert tone="error">Erro ao carregar.</Alert>;
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <h1 className="text-2xl font-black tracking-tight">Planos</h1>
      <Alert tone="info">
        Mudar o preço vale para novas solicitações; assinaturas existentes mantêm o valor contratado. Os limites valem na hora para todos que
        estão no plano.
      </Alert>
      <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <SortableList
          rows={q.data}
          render={(p) => (
            <span className="flex flex-wrap items-center gap-2">
              <strong>{p.name}</strong> {formatBRL(p.price_cents)}
              {p.billing_interval === 'month' ? '/mês' : p.billing_interval === 'year' ? '/ano' : ''}
              {p.is_default ? <Badge variant="neutral">padrão</Badge> : null}
              <span className="text-xs text-ink-muted">até {p.max_products} produtos · {p.max_photos} fotos</span>
            </span>
          )}
          onEdit={(p) => setEditing(p)}
        />
      </section>
      {editing ? (
        <RecordDialog
          key={editing.id}
          title={`Editar plano ${editing.name}`}
          open
          onOpenChange={(v) => !v && setEditing(null)}
          fields={FIELDS}
          initial={{ ...editing, price: (editing.price_cents / 100).toFixed(2).replace('.', ','), features: editing.features.join('; ') }}
          busy={save.isPending}
          onSubmit={(v) => save.mutate({ id: editing.id, v }, { onSuccess: () => setEditing(null) })}
        />
      ) : null}
    </div>
  );
}
