"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { LoaderCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/ui/form-message";
import { VerificationBadge } from "@/components/ui/verification-badge";
import { matchPauta, type PautaResult } from "@/app/actions/pautas";
import { EmploymentLine } from "./employment-line";

export function PautaMatcher() {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<PautaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <form
        className="space-y-3 rounded-lg border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await matchPauta(text);
            if (r.ok && r.data) { setResult(r.data); setError(null); } else if (!r.ok) setError(r.error);
          });
        }}
      >
        <Label htmlFor="pauta">Cole ou escreva a pauta</Label>
        <Textarea id="pauta" className="min-h-32" maxLength={3000} placeholder="Ex.: Projeto de lei sobre incentivos à cultura será votado no Congresso Nacional." value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" disabled={pending || text.trim().length < 15}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />} Encontrar jornalistas
        </Button>
      </form>
      {error ? <FormMessage state={{ ok: false, error }} /> : null}
      {result ? (
        <div className="space-y-4">
          <div className="rounded-lg border bg-primary-soft p-4 text-sm">
            <p className="font-medium text-primary">Como a pauta foi interpretada</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {result.interpretation.explanation.length ? result.interpretation.explanation.map((e) => <li key={e}>{e}</li>) : <li>Nenhuma editoria identificada com segurança; refine o texto.</li>}
            </ul>
          </div>
          {result.candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum jornalista cadastrado atende aos critérios identificados.</p>
          ) : (
            <ol className="space-y-3">
              {result.candidates.map((c, i) => (
                <li key={c.journalist.id} className="rounded-lg border bg-surface p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
                    <Link href={`/jornalistas/${c.journalist.id}`} className="font-semibold text-primary hover:underline">{c.journalist.full_name}</Link>
                    <VerificationBadge status={c.journalist.verification_status} />
                    <Badge variant="outline">{c.score} pts</Badge>
                  </div>
                  <div className="mt-2 space-y-1">{c.journalist.current_employments.map((e) => <EmploymentLine key={e.id} employment={e} compact />)}</div>
                  <ul className="mt-2 flex flex-wrap gap-1">{c.reasons.map((r) => <li key={r}><Badge variant="default">{r}</Badge></li>)}</ul>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </div>
  );
}
