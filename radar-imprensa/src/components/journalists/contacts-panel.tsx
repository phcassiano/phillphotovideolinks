"use client";
import { useState, useTransition } from "react";
import { Copy, ExternalLink, Eye, LoaderCircle, Mail, Phone, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { VerificationBadge } from "@/components/ui/verification-badge";
import type { ContactItem } from "@/lib/domain/types";
import { CONTACT_TYPE_LABELS, CONTACT_VISIBILITY_LABELS } from "@/lib/domain/labels";
import { formatDate } from "@/lib/format";
import { revealContacts } from "@/app/actions/journalists";

function hrefFor(c: ContactItem): string | null {
  if (c.contact_type === "email_profissional") return `mailto:${c.contact_value}`;
  if (c.contact_type === "formulario_contato") return c.contact_value;
  if (c.contact_type === "telefone_profissional") return `tel:${c.contact_value.replace(/[^\d+]/g, "")}`;
  return null;
}

export function ContactsPanel({ journalistId, hasContact, privileged }: { journalistId: string; hasContact: boolean; privileged: boolean }) {
  const [pending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<ContactItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!hasContact && !privileged) {
    return <p className="text-sm text-muted-foreground">Nenhum contato profissional disponível para usuários da plataforma.</p>;
  }

  if (contacts === null) {
    return (
      <div className="space-y-2">
        {error ? <FormMessage state={{ ok: false, error }} /> : null}
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await revealContacts(journalistId);
              if (r.ok) setContacts(r.data ?? []);
              else setError(r.error);
            })
          }
        >
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Eye aria-hidden />}
          Ver contatos profissionais
        </Button>
        <p className="text-xs text-muted-foreground">
          Cada perfil consultado conta no seu limite diário. Os acessos são registrados para prevenir coleta em massa.
        </p>
      </div>
    );
  }

  if (contacts.length === 0) return <p className="text-sm text-muted-foreground">Nenhum contato disponível.</p>;

  return (
    <ul className="space-y-3">
      {contacts.map((c) => {
        const href = hrefFor(c);
        return (
          <li key={c.id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {c.contact_type.startsWith("email") ? <Mail className="size-3.5" aria-hidden /> : <Phone className="size-3.5" aria-hidden />}
                {CONTACT_TYPE_LABELS[c.contact_type]}
                {c.is_primary ? (
                  <span className="inline-flex items-center gap-1 text-accent">
                    <Star className="size-3 fill-current" aria-hidden /> Canal preferencial
                  </span>
                ) : null}
              </p>
              <VerificationBadge status={c.verification_status} />
            </div>
            <div className="mt-1 flex items-center gap-2">
              {href ? (
                <a href={href} className="break-all font-medium text-info hover:underline" rel="noopener noreferrer" target={c.contact_type === "formulario_contato" ? "_blank" : undefined}>
                  {c.contact_value}
                </a>
              ) : (
                <span className="break-all font-medium">{c.contact_value}</span>
              )}
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Copiar contato" onClick={() => navigator.clipboard?.writeText(c.contact_value)}>
                <Copy className="size-3.5" />
              </Button>
            </div>
            {c.professional_purpose ? <p className="mt-1 text-xs text-muted-foreground">Finalidade: {c.professional_purpose}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">
              Confirmado em {formatDate(c.last_verified_at, "nunca")} ·{" "}
              {c.source_url ? (
                <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                  Fonte: {c.source_title ?? "link"} <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : (
                <span>Fonte: {c.source_title ?? "não registrada"}</span>
              )}
              {privileged ? ` · ${CONTACT_VISIBILITY_LABELS[c.visibility]}` : null}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
