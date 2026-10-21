"use client";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import type { JournalistSearchItem } from "@/lib/domain/types";
import { AddToMailingDialog, type MailingOption } from "./add-to-mailing-dialog";
import { FavoriteButton } from "./favorite-button";
import { ResultCardBody } from "./result-card";

export function SearchResults({
  items,
  favoriteIds,
  mailings,
  canManage,
}: {
  items: JournalistSearchItem[];
  favoriteIds: string[];
  mailings: MailingOption[];
  canManage: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const favorites = new Set(favoriteIds);
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-3">
      {canManage ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-surface px-4 py-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
            />
            Selecionar todos desta página
          </label>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {selected.size} selecionado(s)
            </span>
            <AddToMailingDialog journalistIds={[...selected]} mailings={mailings} />
          </div>
        </div>
      ) : null}
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 rounded-lg border bg-surface p-4 shadow-xs">
            {canManage ? (
              <Checkbox
                className="mt-1"
                aria-label={`Selecionar ${item.full_name}`}
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
              />
            ) : null}
            <ResultCardBody item={item} />
            {canManage ? <FavoriteButton journalistId={item.id} initial={favorites.has(item.id)} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
