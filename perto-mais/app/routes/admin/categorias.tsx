import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { AddButton, RecordDialog, SortableList, type FieldDef } from '~/components/admin/crud';
import { CATEGORY_ICONS, CategoryIcon } from '~/components/category-icon';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { useAdminMutation } from '~/features/admin/hooks';
import { useSupabase } from '~/lib/supabase/client';

type Cat = { id: string; name: string; slug: string; icon: string; parent_id: string | null; sort_order: number; is_active: boolean; uses_menu_layout: boolean };

export default function AdminCategorias() {
  const supabase = useSupabase();
  const q = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('id, name, slug, icon, parent_id, sort_order, is_active, uses_menu_layout').order('sort_order').order('name');
      if (error) throw error;
      return data as Cat[];
    },
  });
  const [editing, setEditing] = React.useState<{ row: Partial<Cat> } | null>(null);
  const inv = [['admin', 'categories']];
  const save = useAdminMutation(
    async ({ id, v, parentId }: { id?: string; v: Record<string, string | boolean>; parentId: string | null }) => {
      const row = { name: String(v.name), slug: String(v.slug), icon: String(v.icon), is_active: !!v.is_active, uses_menu_layout: !!v.uses_menu_layout, parent_id: parentId };
      if (id) return supabase.from('categories').update(row).eq('id', id);
      const siblings = q.data?.filter((c) => c.parent_id === parentId).length ?? 0;
      return supabase.from('categories').insert({ ...row, sort_order: siblings + 1 });
    },
    { success: 'Categoria salva.', invalidate: inv },
  );
  const del = useAdminMutation(async (id: string) => supabase.from('categories').delete().eq('id', id), { success: 'Categoria excluída.', invalidate: inv });
  const move = useAdminMutation(
    async ({ a, b }: { a: Cat; b: Cat }) => {
      const r = await supabase.from('categories').update({ sort_order: b.sort_order === a.sort_order ? b.sort_order + 1 : b.sort_order }).eq('id', a.id);
      if (r.error) return r;
      return supabase.from('categories').update({ sort_order: a.sort_order }).eq('id', b.id);
    },
    { invalidate: inv },
  );

  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !q.data) return <Alert tone="error">Erro ao carregar.</Alert>;
  const roots = q.data.filter((c) => !c.parent_id);
  const fields: FieldDef[] = [
    { name: 'name', label: 'Nome' },
    { name: 'slug', label: 'Endereço na URL (slug)', optional: true, hint: 'Gerado do nome se vazio.' },
    { name: 'icon', label: 'Ícone', type: 'select', options: Object.keys(CATEGORY_ICONS).sort().map((k) => ({ value: k, label: k })) },
    { name: 'uses_menu_layout', label: 'Mostrar produtos como cardápio', type: 'checkbox' },
    { name: 'is_active', label: 'Ativa', type: 'checkbox' },
  ];
  const label = (c: Cat) => (
    <span className="flex flex-wrap items-center gap-2">
      <CategoryIcon name={c.icon} className="size-5 text-brand-700" /> <span className="font-semibold">{c.name}</span>
      <span className="text-xs text-ink-muted">/{c.slug}</span>
      {c.uses_menu_layout ? <Badge variant="brand">cardápio</Badge> : null}
    </span>
  );

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-black tracking-tight">Categorias</h1>
        <AddButton onClick={() => setEditing({ row: { is_active: true, icon: 'store', parent_id: null } })}>Categoria principal</AddButton>
      </div>
      <p className="text-sm text-ink-muted">Dois níveis: categoria principal e subcategorias. Categorias com estabelecimentos não podem ser excluídas; desative-as.</p>
      {roots.map((r) => (
        <section key={r.id} className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
          <SortableList
            rows={[r]}
            render={label}
            onEdit={(c) => setEditing({ row: c })}
            onDelete={(c) => del.mutate(c.id)}
          />
          <div className="ml-6 border-l-2 border-line pl-4">
            <SortableList
              rows={q.data.filter((c) => c.parent_id === r.id)}
              render={label}
              onEdit={(c) => setEditing({ row: c })}
              onDelete={(c) => del.mutate(c.id)}
              onMove={(a, b) => move.mutate({ a, b })}
              empty="Sem subcategorias."
            />
            <AddButton onClick={() => setEditing({ row: { is_active: true, icon: r.icon, parent_id: r.id, uses_menu_layout: r.uses_menu_layout } })}>Subcategoria</AddButton>
          </div>
          <div className="mt-2 flex gap-1 text-xs text-ink-muted">
            Ordem:
            <button className="font-semibold text-brand-700 disabled:opacity-40" disabled={roots[0]?.id === r.id} onClick={() => move.mutate({ a: r, b: roots[roots.indexOf(r) - 1]! })}>subir</button>·
            <button className="font-semibold text-brand-700 disabled:opacity-40" disabled={roots.at(-1)?.id === r.id} onClick={() => move.mutate({ a: r, b: roots[roots.indexOf(r) + 1]! })}>descer</button>
          </div>
        </section>
      ))}
      {editing ? (
        <RecordDialog
          key={editing.row.id ?? `novo-${editing.row.parent_id}`}
          title={editing.row.id ? 'Editar categoria' : editing.row.parent_id ? 'Nova subcategoria' : 'Nova categoria'}
          open
          onOpenChange={(v) => !v && setEditing(null)}
          fields={fields}
          initial={editing.row}
          busy={save.isPending}
          onSubmit={(v) => save.mutate({ id: editing.row.id, v, parentId: editing.row.parent_id ?? null }, { onSuccess: () => setEditing(null) })}
        />
      ) : null}
    </div>
  );
}
