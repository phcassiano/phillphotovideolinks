import type { Metadata } from "next";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Termos de uso" };

const RULES = [
  "Use os dados apenas para finalidades profissionais legítimas de comunicação e relacionamento com a imprensa.",
  "Não revenda, publique ou repasse listas extraídas da plataforma a terceiros.",
  "Não tente automatizar consultas, contornar limites de uso ou coletar dados em massa.",
  "Respeite o canal preferido indicado por cada jornalista e pedidos de não contato.",
  "Informe correções quando encontrar dados desatualizados ou incorretos.",
  "Contas são pessoais; o compartilhamento de credenciais é proibido.",
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-primary">Termos de uso</h1>
      <Alert variant="info" className="mt-4">
        <AlertDescription>Texto-base do MVP, sujeito a revisão jurídica antes do lançamento comercial.</AlertDescription>
      </Alert>
      <h2 className="mt-8 text-lg font-semibold text-primary">Regras de uso</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        {RULES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <h2 className="mt-8 text-lg font-semibold text-primary">Sobre as informações</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        As informações profissionais são exibidas com sua situação de verificação e data da última confirmação. Dados marcados
        como &quot;não verificado&quot; ou &quot;desatualizado&quot; podem estar incorretos. A plataforma não garante que um jornalista
        aceitará ou publicará qualquer pauta.
      </p>
      <h2 className="mt-8 text-lg font-semibold text-primary">Suspensão</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Contas que violarem estes termos, em especial por coleta em massa ou uso indevido de contatos, podem ser suspensas, com
        registro em auditoria.
      </p>
    </div>
  );
}
