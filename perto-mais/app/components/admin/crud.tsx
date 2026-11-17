import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import { Field } from '~/components/ui/field';
import { Input, Select } from '~/components/ui/input';

export type FieldDef = {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'checkbox' | 'select';
  options?: { value: string; label: string }[];
  hint?: string;
  optional?: boolean;
  step?: string;
};

/** Formulário simples gerado a partir de uma lista de campos (cadastros-base do admin). */
export function RecordDialog({
  title,
  open,
  onOpenChange,
  fields,
  initial,
  onSubmit,
  busy,
}: {
  title: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fields: FieldDef[];
  initial: Record<string, unknown>;
  onSubmit: (values: Record<string, string | boolean>) => void;
  busy: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const out: Record<string, string | boolean> = {};
            for (const f of fields) out[f.name] = f.type === 'checkbox' ? fd.get(f.name) === 'on' : String(fd.get(f.name) ?? '').trim();
            onSubmit(out);
          }}
        >
          {fields.map((f) =>
            f.type === 'checkbox' ? (
              <label key={f.name} className="flex min-h-11 items-center gap-3 text-sm font-semibold">
                <input type="checkbox" name={f.name} defaultChecked={!!initial[f.name]} className="size-5 accent-[var(--color-brand-700)]" />
                {f.label}
              </label>
            ) : (
              <Field key={f.name} id={`f-${f.name}`} label={f.label} hint={f.hint} optional={f.optional}>
                {f.type === 'select' ? (
                  <Select name={f.name} defaultValue={String(initial[f.name] ?? '')}>
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                ) : (
                  <Input
                    name={f.name}
                    type={f.type === 'number' ? 'number' : 'text'}
                    step={f.step}
                    defaultValue={initial[f.name] == null ? '' : String(initial[f.name])}
                    required={!f.optional}
                  />
                )}
              </Field>
            ),
          )}
          <Button type="submit" disabled={busy}>Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type Row = { id: string; sort_order?: number; is_active?: boolean; [k: string]: unknown };

/** Lista ordenável com editar/excluir. */
export function SortableList<T extends Row>({
  rows,
  render,
  onEdit,
  onDelete,
  onMove,
  empty = 'Nada cadastrado.',
}: {
  rows: T[];
  render: (r: T) => React.ReactNode;
  onEdit: (r: T) => void;
  onDelete?: (r: T) => void;
  onMove?: (a: T, b: T) => void;
  empty?: string;
}) {
  if (!rows.length) return <p className="py-4 text-sm text-ink-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((r, i) => (
        <li key={r.id} className="flex min-h-12 flex-wrap items-center gap-1 py-1.5">
          <div className="min-w-0 flex-1">
            {render(r)} {r.is_active === false ? <Badge variant="closed">inativo</Badge> : null}
          </div>
          {onMove ? (
            <>
              <Button variant="ghost" size="icon" aria-label="Subir" disabled={i === 0} onClick={() => onMove(r, rows[i - 1]!)}><ArrowUp aria-hidden /></Button>
              <Button variant="ghost" size="icon" aria-label="Descer" disabled={i === rows.length - 1} onClick={() => onMove(r, rows[i + 1]!)}><ArrowDown aria-hidden /></Button>
            </>
          ) : null}
          <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => onEdit(r)}><Pencil aria-hidden /></Button>
          {onDelete ? (
            <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => window.confirm('Excluir este item?') && onDelete(r)}><Trash2 aria-hidden /></Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <Plus aria-hidden /> {children}
    </Button>
  );
}

export const num = (v: string | boolean | undefined) => (v === '' || v === undefined || typeof v === 'boolean' ? null : Number(String(v).replace(',', '.')));
