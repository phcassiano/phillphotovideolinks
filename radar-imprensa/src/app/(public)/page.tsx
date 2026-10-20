import Link from "next/link";
import { BadgeCheck, Filter, History, ListChecks, Lock, MapPin, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/ui/verification-badge";

const FEATURES = [
  {
    icon: Filter,
    title: "Busca por editoria e território",
    text: "Combine editoria, subeditoria, estado, cidade, veículo, tipo de mídia e cargo. Os filtros valem para o mesmo vínculo profissional.",
  },
  {
    icon: History,
    title: "Histórico sem confusão",
    text: "Mudanças de veículo e editoria ficam registradas. Antigos empregos nunca aparecem como atuais.",
  },
  {
    icon: BadgeCheck,
    title: "Confiança explícita",
    text: "Cada perfil mostra se foi confirmado, quando e com base em quais fontes públicas. O que não é confirmado aparece como tal.",
  },
  {
    icon: ListChecks,
    title: "Mailings e relacionamento",
    text: "Monte listas por pauta, compartilhe com sua organização, registre interações e exporte apenas contatos autorizados.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="bg-primary text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-teal-300">Inteligência de imprensa</p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Os jornalistas certos para cada pauta, com dados que você pode verificar.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/80">
              O Radar de Imprensa conecta assessores de comunicação a repórteres e editores por editoria, região e veículo, com
              informações profissionais atualizadas e origem documentada.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="accent">
                <Link href="/cadastro">Criar conta</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10">
                <Link href="/login">Já tenho conta</Link>
              </Button>
            </div>
          </div>
          <div aria-hidden className="rounded-xl border border-white/15 bg-white/5 p-5 shadow-2xl">
            <div className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm text-muted-foreground">
              <Search className="size-4" /> Política · Piauí · Portal
            </div>
            <ul className="mt-4 space-y-3">
              {[
                { name: "Repórter de política", outlet: "Portal regional", place: "Teresina/PI", status: "confirmado" as const },
                { name: "Correspondente estadual", outlet: "Portal regional", place: "Piauí", status: "provavel" as const },
                { name: "Editor de política", outlet: "Jornal diário", place: "Teresina/PI", status: "desatualizado" as const },
              ].map((r) => (
                <li key={r.name} className="rounded-md bg-white p-3 text-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{r.name}</p>
                    <VerificationBadge status={r.status} />
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    {r.outlet} · <MapPin className="size-3" /> {r.place}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-center text-xs text-white/60">Ilustração da interface — sem dados reais</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-semibold tracking-tight text-primary">Feito para o dia a dia da assessoria</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border bg-surface p-6">
              <f.icon className="size-6 text-accent" aria-hidden />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-3">
          <div className="md:col-span-1">
            <h2 className="text-2xl font-semibold tracking-tight text-primary">Como mantemos os dados atualizados</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Verificações periódicas, revisão humana e confirmação dos próprios jornalistas. Automação nunca publica, sozinha,
              mudanças de emprego ou contato.
            </p>
          </div>
          <ol className="grid gap-4 md:col-span-2 sm:grid-cols-3">
            {[
              ["Busca periódica", "Cerca de 30 dias por perfil, em lotes pequenos, apenas em fontes autorizadas."],
              ["Evidência registrada", "URL, data e resumo de cada fonte encontrada ficam vinculados ao dado."],
              ["Revisão e confirmação", "Alterações sensíveis passam por um administrador ou pelo próprio titular."],
            ].map(([title, text], i) => (
              <li key={title} className="rounded-lg border p-4">
                <span className="text-xs font-semibold text-accent">Etapa {i + 1}</span>
                <p className="mt-1 font-medium">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-col gap-6 rounded-xl border bg-primary-soft p-8 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-4">
            <ShieldCheck className="size-8 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold text-primary">Privacidade como requisito, não como apêndice</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Tratamos apenas contatos profissionais, com origem registrada e finalidade informada. Jornalistas podem reivindicar o
                próprio perfil, corrigir dados, escolher o canal preferido ou se opor ao tratamento.
              </p>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/privacidade">
              <Lock aria-hidden /> Política de privacidade
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
