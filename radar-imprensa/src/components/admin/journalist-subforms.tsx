"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/ui/form-message";
import { useAction } from "@/components/profile/use-action";
import { EVIDENCE_TYPES, OUTLET_TYPES, type EvidenceType, type OutletType } from "@/lib/domain/enums";
import { CONTACT_TYPE_LABELS, CONTACT_VISIBILITY_LABELS, EVIDENCE_TYPE_LABELS, OUTLET_TYPE_LABELS } from "@/lib/domain/labels";
import { addContact, addEmployment, addEvidence, createOutlet, endEmployment } from "@/app/actions/admin/journalists";

type Opt = { id: string; label: string };

export function AdminEmploymentForm({ journalistId, outlets, locations, categories }: { journalistId: string; outlets: Opt[]; locations: Opt[]; categories: Opt[] }) {
  const { pending, result, run } = useAction();
  const empty = { mediaOutletId: "", jobTitle: "", locationId: "", categoryIds: [] as string[], startDate: "", sourceUrl: "", sourceTitle: "" };
  const [f, setF] = useState(empty);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => addEmployment({ journalistId, ...f }), () => setF(empty)); }}>
      <FormMessage state={result} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ae-outlet">Veículo</Label>
          <NativeSelect id="ae-outlet" className="mt-1.5" value={f.mediaOutletId} onChange={(e) => setF({ ...f, mediaOutletId: e.target.value })} required>
            <option value="">Selecione…</option>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="ae-title">Cargo</Label>
          <Input id="ae-title" className="mt-1.5" value={f.jobTitle} onChange={(e) => setF({ ...f, jobTitle: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="ae-loc">Local de atuação</Label>
          <NativeSelect id="ae-loc" className="mt-1.5" value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })}>
            <option value="">Não informado</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="ae-start">Início</Label>
          <Input id="ae-start" type="date" className="mt-1.5" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
        </div>
      </div>
      <div>
        <Label htmlFor="ae-cats">Editorias</Label>
        <select id="ae-cats" multiple className="mt-1.5 h-28 w-full rounded-md border border-input bg-surface p-2 text-sm" value={f.categoryIds} onChange={(e) => setF({ ...f, categoryIds: Array.from(e.target.selectedOptions, (o) => o.value) })}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ae-src-url">URL da fonte</Label>
          <Input id="ae-src-url" className="mt-1.5" placeholder="https://" value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="ae-src-title">Descrição da fonte</Label>
          <Input id="ae-src-title" className="mt-1.5" placeholder="Ex.: expediente do veículo" value={f.sourceTitle} onChange={(e) => setF({ ...f, sourceTitle: e.target.value })} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Com fonte, o vínculo entra como confirmado; sem fonte, como não verificado.</p>
      <Button type="submit" size="sm" disabled={pending || !f.mediaOutletId}>Adicionar vínculo</Button>
    </form>
  );
}

export function EndEmploymentInline({ journalistId, employmentId }: { journalistId: string; employmentId: string }) {
  const { pending, result, run } = useAction();
  const [date, setDate] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <Label htmlFor={`end-${employmentId}`} className="text-xs">Encerrar em</Label>
        <Input id={`end-${employmentId}`} type="date" className="mt-1 h-8 text-xs" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <Button size="sm" variant="outline" disabled={pending || !date} onClick={() => run(() => endEmployment(journalistId, employmentId, date))}>Encerrar</Button>
      {result && !result.ok ? <span className="text-xs text-danger">{result.error}</span> : null}
    </div>
  );
}

export function AdminContactForm({ journalistId }: { journalistId: string }) {
  const { pending, result, run } = useAction();
  const empty = { contactType: "email_profissional" as const, contactValue: "", visibility: "restrito" as "assinantes" | "restrito" | "oculto", professionalPurpose: "", sourceUrl: "", sourceTitle: "" };
  const [f, setF] = useState<{ contactType: "email_profissional" | "telefone_profissional" | "formulario_contato"; contactValue: string; visibility: "assinantes" | "restrito" | "oculto"; professionalPurpose: string; sourceUrl: string; sourceTitle: string }>(empty);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => addContact({ journalistId, ...f }), () => setF(empty)); }}>
      <FormMessage state={result} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ac-type">Tipo</Label>
          <NativeSelect id="ac-type" className="mt-1.5" value={f.contactType} onChange={(e) => setF({ ...f, contactType: e.target.value as typeof f.contactType })}>
            {(["email_profissional", "telefone_profissional", "formulario_contato"] as const).map((t) => <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>)}
          </NativeSelect>
          <p className="mt-1 text-xs text-muted-foreground">WhatsApp só pode ser informado pelo próprio titular.</p>
        </div>
        <div>
          <Label htmlFor="ac-value">Contato</Label>
          <Input id="ac-value" className="mt-1.5" value={f.contactValue} onChange={(e) => setF({ ...f, contactValue: e.target.value })} required />
        </div>
        <div>
          <Label htmlFor="ac-vis">Visibilidade</Label>
          <NativeSelect id="ac-vis" className="mt-1.5" value={f.visibility} onChange={(e) => setF({ ...f, visibility: e.target.value as typeof f.visibility })}>
            {(["restrito", "assinantes", "oculto"] as const).map((v) => <option key={v} value={v}>{CONTACT_VISIBILITY_LABELS[v]}</option>)}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="ac-purpose">Finalidade</Label>
          <Input id="ac-purpose" className="mt-1.5" value={f.professionalPurpose} onChange={(e) => setF({ ...f, professionalPurpose: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="ac-src-url">URL da fonte</Label>
          <Input id="ac-src-url" className="mt-1.5" placeholder="https://" value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="ac-src-title">Descrição da fonte</Label>
          <Input id="ac-src-title" className="mt-1.5" value={f.sourceTitle} onChange={(e) => setF({ ...f, sourceTitle: e.target.value })} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Nunca preencha contatos inventados ou deduzidos. Contatos visíveis a usuários exigem fonte.</p>
      <Button type="submit" size="sm" disabled={pending || f.contactValue.trim().length < 3}>Adicionar contato</Button>
    </form>
  );
}

export function AdminEvidenceForm({ journalistId }: { journalistId: string }) {
  const { pending, result, run } = useAction();
  const types = EVIDENCE_TYPES.filter((t) => t !== "demonstrativa" && t !== "busca_automatizada") as Exclude<EvidenceType, "demonstrativa" | "busca_automatizada">[];
  const empty = { sourceUrl: "", sourceTitle: "", evidenceType: "perfil_institucional" as (typeof types)[number], summary: "", observedAt: "" };
  const [f, setF] = useState(empty);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => addEvidence({ journalistId, ...f }), () => setF(empty)); }}>
      <FormMessage state={result} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="ev-title">Título da fonte</Label>
          <Input id="ev-title" className="mt-1.5" value={f.sourceTitle} onChange={(e) => setF({ ...f, sourceTitle: e.target.value })} required />
        </div>
        <div>
          <Label htmlFor="ev-url">URL</Label>
          <Input id="ev-url" className="mt-1.5" placeholder="https://" value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="ev-type">Tipo</Label>
          <NativeSelect id="ev-type" className="mt-1.5" value={f.evidenceType} onChange={(e) => setF({ ...f, evidenceType: e.target.value as (typeof types)[number] })}>
            {types.map((t) => <option key={t} value={t}>{EVIDENCE_TYPE_LABELS[t]}</option>)}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="ev-date">Observada em</Label>
          <Input id="ev-date" type="date" className="mt-1.5" value={f.observedAt} onChange={(e) => setF({ ...f, observedAt: e.target.value })} />
        </div>
      </div>
      <div>
        <Label htmlFor="ev-summary">Resumo do que a fonte comprova</Label>
        <Textarea id="ev-summary" className="mt-1.5 min-h-16" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
      </div>
      <Button type="submit" size="sm" disabled={pending || f.sourceTitle.trim().length < 3}>Registrar evidência</Button>
    </form>
  );
}

export function OutletForm({ cities }: { cities: Opt[] }) {
  const { pending, result, run } = useAction();
  const empty = { name: "", website: "", outletType: "portal" as OutletType, headquartersCityId: "" };
  const [f, setF] = useState(empty);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => createOutlet(f), () => setF(empty)); }}>
      <FormMessage state={result} />
      <div>
        <Label htmlFor="o-name">Nome do veículo</Label>
        <Input id="o-name" className="mt-1.5" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
      </div>
      <div>
        <Label htmlFor="o-site">Site</Label>
        <Input id="o-site" className="mt-1.5" placeholder="https://" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="o-type">Tipo</Label>
          <NativeSelect id="o-type" className="mt-1.5" value={f.outletType} onChange={(e) => setF({ ...f, outletType: e.target.value as OutletType })}>
            {OUTLET_TYPES.map((t) => <option key={t} value={t}>{OUTLET_TYPE_LABELS[t]}</option>)}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="o-city">Sede</Label>
          <NativeSelect id="o-city" className="mt-1.5" value={f.headquartersCityId} onChange={(e) => setF({ ...f, headquartersCityId: e.target.value })}>
            <option value="">Não informada</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </NativeSelect>
        </div>
      </div>
      <Button type="submit" size="sm" disabled={pending || f.name.trim().length < 2}>Cadastrar veículo</Button>
    </form>
  );
}
