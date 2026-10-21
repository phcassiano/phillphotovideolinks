"use client";
import { useState } from "react";
import { BadgeCheck, Star, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/ui/form-message";
import { VerificationBadge } from "@/components/ui/verification-badge";
import { CONTACT_TYPES, PROFESSIONAL_STATUSES, type ContactType, type ProfessionalStatus, type VerificationStatus } from "@/lib/domain/enums";
import { CONTACT_TYPE_LABELS, CONTACT_VISIBILITY_LABELS, PROFESSIONAL_STATUS_LABELS } from "@/lib/domain/labels";
import { formatDate } from "@/lib/format";
import {
  addOwnContact, addOwnEmployment, addOwnTopic, confirmOwnProfile, deleteOwnContact, endOwnEmployment,
  removeOwnTopic, setContactVisibility, setPrimaryContact, updateOwnProfile,
} from "@/app/actions/profile";
import { useAction } from "./use-action";

export function OwnProfileForm({ initial }: { initial: { professionalName: string; biography: string; professionalStatus: ProfessionalStatus } }) {
  const [values, setValues] = useState(initial);
  const { pending, result, run } = useAction();
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => updateOwnProfile(values)); }}>
      <FormMessage state={result} />
      <div>
        <Label htmlFor="own-pro-name">Nome profissional (como assina)</Label>
        <Input id="own-pro-name" className="mt-1.5" value={values.professionalName} maxLength={160} onChange={(e) => setValues({ ...values, professionalName: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="own-status">Situação profissional</Label>
        <NativeSelect id="own-status" className="mt-1.5" value={values.professionalStatus} onChange={(e) => setValues({ ...values, professionalStatus: e.target.value as ProfessionalStatus })}>
          {PROFESSIONAL_STATUSES.map((s) => <option key={s} value={s}>{PROFESSIONAL_STATUS_LABELS[s]}</option>)}
        </NativeSelect>
      </div>
      <div>
        <Label htmlFor="own-bio">Biografia profissional</Label>
        <Textarea id="own-bio" className="mt-1.5" value={values.biography} maxLength={2000} onChange={(e) => setValues({ ...values, biography: e.target.value })} />
      </div>
      <Button type="submit" disabled={pending}>Salvar perfil</Button>
    </form>
  );
}

export interface OwnContact {
  id: string;
  contact_type: ContactType;
  contact_value: string;
  is_primary: boolean;
  visibility: "assinantes" | "restrito" | "oculto";
  verification_status: VerificationStatus;
}

export function OwnContacts({ contacts }: { contacts: OwnContact[] }) {
  const { pending, result, run } = useAction();
  const empty = { contactType: "email_profissional" as ContactType, contactValue: "", visibility: "assinantes" as "assinantes" | "restrito", professionalPurpose: "", isPrimary: contacts.length === 0, consent: false };
  const [form, setForm] = useState(empty);
  return (
    <div className="space-y-4">
      <FormMessage state={result} />
      {contacts.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum contato cadastrado.</p> : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{CONTACT_TYPE_LABELS[c.contact_type]}</p>
                <p className="break-all font-medium">{c.contact_value}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <VerificationBadge status={c.verification_status} />
                  {c.is_primary ? <Badge variant="success"><Star aria-hidden /> Preferencial</Badge> : null}
                  <Badge variant="outline">{CONTACT_VISIBILITY_LABELS[c.visibility]}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {!c.is_primary ? <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setPrimaryContact(c.id))}>Tornar preferencial</Button> : null}
                {c.visibility !== "oculto" ? (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setContactVisibility(c.id, c.visibility === "assinantes" ? "restrito" : "assinantes"))}>
                    {c.visibility === "assinantes" ? "Restringir" : "Tornar visível"}
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" aria-label="Remover contato" disabled={pending} onClick={() => run(() => deleteOwnContact(c.id))}><Trash2 /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className="space-y-3 rounded-md border bg-muted/40 p-3" onSubmit={(e) => { e.preventDefault(); run(() => addOwnContact(form), () => setForm({ ...empty, isPrimary: false })); }}>
        <p className="text-sm font-medium">Adicionar contato profissional</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="c-type">Tipo</Label>
            <NativeSelect id="c-type" className="mt-1.5" value={form.contactType} onChange={(e) => setForm({ ...form, contactType: e.target.value as ContactType })}>
              {CONTACT_TYPES.map((t) => <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="c-value">Contato</Label>
            <Input id="c-value" className="mt-1.5" value={form.contactValue} onChange={(e) => setForm({ ...form, contactValue: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="c-vis">Quem pode ver</Label>
            <NativeSelect id="c-vis" className="mt-1.5" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as "assinantes" | "restrito" })}>
              <option value="assinantes">{CONTACT_VISIBILITY_LABELS.assinantes}</option>
              <option value="restrito">{CONTACT_VISIBILITY_LABELS.restrito}</option>
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="c-purpose">Finalidade (opcional)</Label>
            <Input id="c-purpose" className="mt-1.5" placeholder="Ex.: pautas de cultura" value={form.professionalPurpose} onChange={(e) => setForm({ ...form, professionalPurpose: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} /> Canal preferencial</label>
        {form.contactType === "whatsapp_profissional" ? (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
            Autorizo a exibição deste número de WhatsApp profissional para contatos de imprensa.
          </label>
        ) : null}
        <Button type="submit" size="sm" disabled={pending || form.contactValue.trim().length < 3}>Adicionar contato</Button>
      </form>
    </div>
  );
}

export interface OwnEmployment {
  id: string;
  outlet: string;
  job_title: string | null;
  start_date: string | null;
  verification_status: VerificationStatus;
}

export function OwnEmployments({
  employments,
  outlets,
  locations,
  categories,
}: {
  employments: OwnEmployment[];
  outlets: { id: string; name: string }[];
  locations: { id: string; label: string }[];
  categories: { id: string; label: string }[];
}) {
  const { pending, result, run } = useAction();
  const today = new Date().toISOString().slice(0, 10);
  const [endDates, setEndDates] = useState<Record<string, string>>({});
  const empty = { mediaOutletId: "", jobTitle: "", locationId: "", categoryIds: [] as string[], startDate: "" };
  const [form, setForm] = useState(empty);
  return (
    <div className="space-y-4">
      <FormMessage state={result} />
      {employments.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum vínculo atual.</p> : (
        <ul className="space-y-2">
          {employments.map((e) => (
            <li key={e.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-medium">{e.job_title ?? "Cargo não informado"} · {e.outlet}</p>
                <p className="text-xs text-muted-foreground">Desde {formatDate(e.start_date, "data não informada")}</p>
                <VerificationBadge status={e.verification_status} className="mt-1" />
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <Label htmlFor={`end-${e.id}`} className="text-xs">Encerrado em</Label>
                  <Input id={`end-${e.id}`} type="date" max={today} className="mt-1 h-8 text-xs" value={endDates[e.id] ?? ""} onChange={(ev) => setEndDates({ ...endDates, [e.id]: ev.target.value })} />
                </div>
                <Button size="sm" variant="outline" disabled={pending || !endDates[e.id]} onClick={() => run(() => endOwnEmployment(e.id, endDates[e.id]!))}>
                  Encerrar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className="space-y-3 rounded-md border bg-muted/40 p-3" onSubmit={(e) => { e.preventDefault(); run(() => addOwnEmployment(form), () => setForm(empty)); }}>
        <p className="text-sm font-medium">Adicionar vínculo atual</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="e-outlet">Veículo</Label>
            <NativeSelect id="e-outlet" className="mt-1.5" value={form.mediaOutletId} onChange={(e) => setForm({ ...form, mediaOutletId: e.target.value })} required>
              <option value="">Selecione…</option>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </NativeSelect>
            <p className="mt-1 text-xs text-muted-foreground">Veículo não listado? Use “Sugerir correção” no seu perfil público.</p>
          </div>
          <div>
            <Label htmlFor="e-title">Cargo</Label>
            <Input id="e-title" className="mt-1.5" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="e-location">Local de atuação</Label>
            <NativeSelect id="e-location" className="mt-1.5" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
              <option value="">Não informar</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="e-start">Início</Label>
            <Input id="e-start" type="date" max={today} className="mt-1.5" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
        </div>
        <div>
          <Label htmlFor="e-cats">Editorias (Ctrl/Cmd para várias)</Label>
          <select
            id="e-cats"
            multiple
            className="mt-1.5 h-32 w-full rounded-md border border-input bg-surface p-2 text-sm"
            value={form.categoryIds}
            onChange={(e) => setForm({ ...form, categoryIds: Array.from(e.target.selectedOptions, (o) => o.value) })}
          >
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={pending || !form.mediaOutletId}>Adicionar vínculo</Button>
      </form>
    </div>
  );
}

export function OwnTopics({ topics }: { topics: { id: string; name: string }[] }) {
  const { pending, result, run } = useAction();
  const [name, setName] = useState("");
  return (
    <div className="space-y-3">
      <FormMessage state={result} />
      <div className="flex flex-wrap gap-1">
        {topics.length === 0 ? <span className="text-sm text-muted-foreground">Nenhum tema informado.</span> : topics.map((t) => (
          <Badge key={t.id} variant="outline" className="pr-1">
            {t.name}
            <button type="button" className="rounded-full p-0.5 hover:bg-muted" aria-label={`Remover tema ${t.name}`} disabled={pending} onClick={() => run(() => removeOwnTopic(t.id))}>
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => addOwnTopic(name), () => setName("")); }}>
        <Label htmlFor="topic-name" className="sr-only">Novo tema</Label>
        <Input id="topic-name" placeholder="Ex.: transição energética" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <Button type="submit" variant="outline" disabled={pending || name.trim().length < 2}>Adicionar</Button>
      </form>
    </div>
  );
}

export function ConfirmProfileButton() {
  const { pending, result, run } = useAction();
  return (
    <div className="space-y-2">
      <FormMessage state={result} />
      <Button variant="accent" disabled={pending} onClick={() => run(() => confirmOwnProfile())}>
        <BadgeCheck aria-hidden /> Confirmar que meus dados atuais estão corretos
      </Button>
    </div>
  );
}
