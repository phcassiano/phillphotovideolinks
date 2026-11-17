import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { AddButton, num, RecordDialog, SortableList, type FieldDef } from '~/components/admin/crud';
import { Alert } from '~/components/ui/alert';
import { Skeleton } from '~/components/ui/skeleton';
import { useAdminMutation } from '~/features/admin/hooks';
import { slugify } from '~/lib/slug';
import { useSupabase } from '~/lib/supabase/client';
import { cn } from '~/lib/utils';

type Editing = { kind: 'state' | 'city' | 'hood'; row: Record<string, unknown> | null } | null;

export default function AdminLocais() {
  const supabase = useSupabase();
  const q = useQuery({
    queryKey: ['admin', 'places'],
    queryFn: async () => {
      const [s, c, n] = await Promise.all([
        supabase.from('states').select('*').order('name'),
        supabase.from('cities').select('*').order('sort_order').order('name'),
        supabase.from('neighborhoods').select('*').order('sort_order').order('name'),
      ]);
      if (s.error || c.error || n.error) throw s.error ?? c.error ?? n.error;
      return { states: s.data, cities: c.data, hoods: n.data };
    },
  });
  const [cityId, setCityId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Editing>(null);
  const inv = [['admin', 'places']];

  const save = useAdminMutation(
    async ({ kind, id, v }: { kind: 'state' | 'city' | 'hood'; id?: string; v: Record<string, string | boolean> }) => {
      if (kind === 'state') {
        const row = { name: String(v.name), uf: String(v.uf).toUpperCase(), slug: slugify(String(v.slug || v.name)) };
        return id ? supabase.from('states').update(row).eq('id', id) : supabase.from('states').insert(row);
      }
      if (kind === 'city') {
        const row = { name: String(v.name), slug: String(v.slug), state_id: String(v.state_id), latitude: num(v.latitude), longitude: num(v.longitude), is_active: !!v.is_active };
        return id ? supabase.from('cities').update(row).eq('id', id) : supabase.from('cities').insert({ ...row, sort_order: (q.data?.cities.length ?? 0) + 1 });
      }
      const row = { name: String(v.name), slug: String(v.slug), latitude: num(v.latitude), longitude: num(v.longitude), is_active: !!v.is_active };
      return id
        ? supabase.from('neighborhoods').update(row).eq('id', id)
        : supabase.from('neighborhoods').insert({ ...row, city_id: cityId!, sort_order: (q.data?.hoods.filter((h) => h.city_id === cityId).length ?? 0) + 1 });
    },
    { success: 'Salvo.', invalidate: inv },
  );
  const del = useAdminMutation(async ({ table, id }: { table: 'cities' | 'neighborhoods'; id: string }) => supabase.from(table).delete().eq('id', id), {
    success: 'Excluído.',
    invalidate: inv,
  });
  const move = useAdminMutation(
    async ({ table, a, b }: { table: 'cities' | 'neighborhoods'; a: { id: string; sort_order: number }; b: { id: string; sort_order: number } }) => {
      const r1 = await supabase.from(table).update({ sort_order: b.sort_order === a.sort_order ? b.sort_order + 1 : b.sort_order }).eq('id', a.id);
      if (r1.error) return r1;
      return supabase.from(table).update({ sort_order: a.sort_order }).eq('id', b.id);
    },
    { invalidate: inv },
  );

  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !q.data) return <Alert tone="error">Erro ao carregar.</Alert>;
  const { states, cities, hoods } = q.data;
  const city = cities.find((c) => c.id === cityId) ?? cities[0];
  const cityHoods = hoods.filter((h) => h.city_id === city?.id);

  const coordFields: FieldDef[] = [
    { name: 'latitude', label: 'Latitude', type: 'number', step: 'any', optional: true, hint: 'Centro aproximado, usado no mapa e em "Usar minha localização".' },
    { name: 'longitude', label: 'Longitude', type: 'number', step: 'any', optional: true },
    { name: 'is_active', label: 'Ativo', type: 'checkbox' },
  ];
  const fieldsFor = (kind: 'state' | 'city' | 'hood'): FieldDef[] =>
    kind === 'state'
      ? [{ name: 'name', label: 'Nome' }, { name: 'uf', label: 'UF' }, { name: 'slug', label: 'Endereço (slug)', optional: true }]
      : kind === 'city'
        ? [
            { name: 'name', label: 'Nome' },
            { name: 'slug', label: 'Endereço na URL (slug)', optional: true, hint: 'Gerado do nome se vazio. Palavras reservadas do site são recusadas.' },
            { name: 'state_id', label: 'Estado', type: 'select', options: states.map((s) => ({ value: s.id, label: `${s.name} (${s.uf})` })) },
            ...coordFields,
          ]
        : [{ name: 'name', label: 'Nome' }, { name: 'slug', label: 'Endereço na URL (slug)', optional: true, hint: 'Gerado do nome se vazio.' }, ...coordFields];

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <h1 className="text-2xl font-black tracking-tight">Cidades e bairros</h1>
      <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">Estados</h2>
          <AddButton onClick={() => setEditing({ kind: 'state', row: null })}>Estado</AddButton>
        </div>
        <SortableList rows={states} render={(s) => `${s.name} (${s.uf})`} onEdit={(s) => setEditing({ kind: 'state', row: s })} />
      </section>
      <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">Cidades</h2>
          <AddButton onClick={() => setEditing({ kind: 'city', row: { is_active: true, state_id: states[0]?.id } })}>Cidade</AddButton>
        </div>
        <SortableList
          rows={cities}
          render={(c) => (
            <button type="button" onClick={() => setCityId(c.id)} className={cn('min-h-11 text-left font-semibold', city?.id === c.id && 'text-brand-700')}>
              {c.name} <span className="font-normal text-ink-muted">/{c.slug}</span>
            </button>
          )}
          onEdit={(c) => setEditing({ kind: 'city', row: c })}
          onDelete={(c) => del.mutate({ table: 'cities', id: c.id })}
          onMove={(a, b) => move.mutate({ table: 'cities', a, b })}
        />
      </section>
      {city ? (
        <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">Bairros de {city.name}</h2>
            <AddButton onClick={() => setEditing({ kind: 'hood', row: { is_active: true } })}>Bairro</AddButton>
          </div>
          <SortableList
            rows={cityHoods}
            render={(n) => <span>{n.name} <span className="text-ink-muted">/{city.slug}/{n.slug}</span></span>}
            onEdit={(n) => setEditing({ kind: 'hood', row: n })}
            onDelete={(n) => del.mutate({ table: 'neighborhoods', id: n.id })}
            onMove={(a, b) => move.mutate({ table: 'neighborhoods', a, b })}
            empty="Nenhum bairro."
          />
          <p className="mt-2 text-xs text-ink-muted">Bairros ou cidades com estabelecimentos não podem ser excluídos; desative-os.</p>
        </section>
      ) : null}
      {editing ? (
        <RecordDialog
          key={`${editing.kind}-${String(editing.row?.id ?? 'novo')}`}
          title={`${editing.row?.id ? 'Editar' : 'Novo'} ${editing.kind === 'state' ? 'estado' : editing.kind === 'city' ? 'cidade' : 'bairro'}`}
          open
          onOpenChange={(v) => !v && setEditing(null)}
          fields={fieldsFor(editing.kind)}
          initial={editing.row ?? {}}
          busy={save.isPending}
          onSubmit={(v) =>
            save.mutate({ kind: editing.kind, id: editing.row?.id as string | undefined, v }, { onSuccess: () => setEditing(null) })
          }
        />
      ) : null}
    </div>
  );
}
