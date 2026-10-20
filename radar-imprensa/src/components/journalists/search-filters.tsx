"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { OUTLET_TYPES } from "@/lib/domain/enums";
import { OUTLET_TYPE_LABELS } from "@/lib/domain/labels";
import { SORT_LABELS, SORT_OPTIONS, toSearchParams, type SearchFilters } from "@/lib/search/filters";

interface Option {
  id: string;
  name: string;
}

export interface FilterOptions {
  categories: { parent: Option; children: Option[] }[];
  states: { state_code: string; state_name: string }[];
  cities: { id: string; city_name: string | null; state_code: string }[];
  outlets: Option[];
}

// Formulário GET (funciona sem JavaScript); com JavaScript, aplica os filtros
// sem recarregar a página e mantém tudo persistido na URL.
export function SearchFiltersForm({ filters, options }: { filters: SearchFilters; options: FilterOptions }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SearchFilters>(filters);

  const apply = (next: SearchFilters) => {
    setState(next);
    startTransition(() => router.push(`/jornalistas?${toSearchParams({ ...next, pagina: 1 }).toString()}`));
  };
  const update = (patch: Partial<SearchFilters>, immediate = true) => {
    const next = { ...state, ...patch };
    if (immediate) apply(next);
    else setState(next);
  };

  const subcategories = state.editoria
    ? options.categories.find((g) => g.parent.id === state.editoria)?.children ?? []
    : options.categories.flatMap((g) => g.children);
  const cities = options.cities.filter((c) => c.city_name && (!state.uf || c.state_code === state.uf));

  return (
    <form
      method="get"
      action="/jornalistas"
      role="search"
      aria-label="Filtros de busca de jornalistas"
      onSubmit={(e) => {
        e.preventDefault();
        apply(state);
      }}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="q">Nome ou tema</Label>
        <div className="mt-1.5 flex gap-2">
          <Input
            id="q"
            name="q"
            placeholder="Ex.: Ana Ribeiro, orçamento público"
            value={state.q ?? ""}
            onChange={(e) => update({ q: e.target.value || undefined }, false)}
          />
          <Button type="submit" size="icon" aria-label="Buscar" disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Search />}
          </Button>
        </div>
      </div>

      <div>
        <Label htmlFor="editoria">Editoria</Label>
        <NativeSelect
          id="editoria"
          name="editoria"
          className="mt-1.5"
          value={state.editoria ?? ""}
          onChange={(e) => update({ editoria: e.target.value || undefined, subeditoria: undefined })}
        >
          <option value="">Todas</option>
          {options.categories.map((g) => (
            <option key={g.parent.id} value={g.parent.id}>
              {g.parent.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div>
        <Label htmlFor="subeditoria">Subeditoria</Label>
        <NativeSelect
          id="subeditoria"
          name="subeditoria"
          className="mt-1.5"
          value={state.subeditoria ?? ""}
          onChange={(e) => update({ subeditoria: e.target.value || undefined })}
          disabled={subcategories.length === 0}
        >
          <option value="">Todas</option>
          {subcategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="uf">Estado</Label>
          <NativeSelect id="uf" name="uf" className="mt-1.5" value={state.uf ?? ""} onChange={(e) => update({ uf: (e.target.value || undefined) as SearchFilters["uf"], cidade: undefined })}>
            <option value="">Todos</option>
            {options.states.map((s) => (
              <option key={s.state_code} value={s.state_code}>
                {s.state_code} — {s.state_name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="cidade">Cidade</Label>
          <NativeSelect id="cidade" name="cidade" className="mt-1.5" value={state.cidade ?? ""} onChange={(e) => update({ cidade: e.target.value || undefined })} disabled={!state.uf}>
            <option value="">{state.uf ? "Todas" : "Escolha o estado"}</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.city_name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div>
        <Label htmlFor="veiculo">Veículo</Label>
        <NativeSelect id="veiculo" name="veiculo" className="mt-1.5" value={state.veiculo ?? ""} onChange={(e) => update({ veiculo: e.target.value || undefined })}>
          <option value="">Todos</option>
          {options.outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Tipo de mídia</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {OUTLET_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <Checkbox
                name="tipo"
                value={t}
                checked={state.tipo.includes(t)}
                onChange={(e) => update({ tipo: e.target.checked ? [...state.tipo, t] : state.tipo.filter((x) => x !== t) })}
              />
              {OUTLET_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="cargo">Cargo ou função</Label>
        <Input
          id="cargo"
          name="cargo"
          className="mt-1.5"
          placeholder="Ex.: editor, repórter"
          value={state.cargo ?? ""}
          onChange={(e) => update({ cargo: e.target.value || undefined }, false)}
          onBlur={() => state.cargo !== filters.cargo && apply(state)}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Opções</legend>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="contato" value="1" checked={state.contato} onChange={(e) => update({ contato: e.target.checked })} />
          Com contato profissional disponível
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="verificados" value="1" checked={state.verificados} onChange={(e) => update({ verificados: e.target.checked })} />
          Somente perfis confirmados
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="atual" value="1" checked={state.atual} onChange={(e) => update({ atual: e.target.checked })} />
          Somente atuação atual
        </label>
        <input type="hidden" name="atual" value="0" />
        {!state.atual ? (
          <p className="text-xs text-warning">Incluindo vínculos anteriores: resultados de empregos passados são sinalizados.</p>
        ) : null}
      </fieldset>

      <div>
        <Label htmlFor="ordem">Ordenar por</Label>
        <NativeSelect id="ordem" name="ordem" className="mt-1.5" value={state.ordem} onChange={(e) => update({ ordem: e.target.value as SearchFilters["ordem"] })}>
          {SORT_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </NativeSelect>
      </div>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => apply({ tipo: [], contato: false, verificados: false, atual: true, ordem: "relevancia", pagina: 1 })}
      >
        <RotateCcw aria-hidden /> Limpar filtros
      </Button>
    </form>
  );
}
