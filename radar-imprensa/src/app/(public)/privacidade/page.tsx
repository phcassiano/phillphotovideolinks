import type { Metadata } from "next";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrivacyRequestForm } from "@/components/forms/privacy-request-form";
import { getSessionUser } from "@/lib/auth/session";
import { PRIVACY_REQUEST_TYPE_LABELS, PRIVACY_STATUS_LABELS } from "@/lib/domain/labels";
import type { PrivacyRequestStatus, PrivacyRequestType } from "@/lib/domain/enums";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Privacidade" };

const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "privacidade@radar-imprensa.example";

// Base legal documentada por categoria de tratamento (LGPD, art. 7º).
const LEGAL_BASES = [
  {
    category: "Dados profissionais de jornalistas (nome, veículo, cargo, editorias, local de atuação)",
    purpose: "Permitir que profissionais de comunicação encontrem jornalistas adequados às suas pautas.",
    basis: "Legítimo interesse (art. 7º, IX), com teste de balanceamento e direito de oposição; dados tornados públicos pelo titular (art. 7º, §4º).",
  },
  {
    category: "Contatos profissionais (e-mail e telefone da redação ou profissional)",
    purpose: "Viabilizar o envio de pautas e releases ao canal profissional adequado.",
    basis: "Legítimo interesse, com origem registrada para cada contato; consentimento quando informado pelo próprio titular.",
  },
  {
    category: "WhatsApp profissional",
    purpose: "Canal alternativo indicado pelo próprio jornalista.",
    basis: "Somente com consentimento registrado do titular (art. 7º, I). Nunca inferido de dados incompletos.",
  },
  {
    category: "Dados de conta de usuários (nome, e-mail, organização)",
    purpose: "Autenticação, controle de acesso, segurança e auditoria.",
    basis: "Execução de contrato (art. 7º, V) e cumprimento de obrigação legal (art. 7º, II) quanto a registros de acesso.",
  },
  {
    category: "Registros de uso (consultas, exportações, logs administrativos)",
    purpose: "Prevenir coleta em massa, investigar abusos e garantir rastreabilidade.",
    basis: "Legítimo interesse em segurança da informação (art. 7º, IX).",
  },
];

export default async function PrivacyPage() {
  const user = await getSessionUser();
  let requests: { id: string; request_type: PrivacyRequestType; status: PrivacyRequestStatus; created_at: string; resolution_notes: string | null }[] = [];
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("privacy_requests")
      .select("id, request_type, status, created_at, resolution_notes")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    requests = data ?? [];
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-wider text-accent">LGPD</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-primary">Política de privacidade</h1>
      <Alert variant="info" className="mt-4">
        <AlertDescription>
          Texto-base do MVP. Antes do lançamento comercial, deve ser revisado por assessoria jurídica e completado com a
          identificação do controlador e do encarregado.
        </AlertDescription>
      </Alert>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-primary">
        <section>
          <h2>1. O que fazemos</h2>
          <p className="mt-2 text-muted-foreground">
            O Radar de Imprensa organiza informações <strong>profissionais</strong> de jornalistas para que assessores de comunicação
            encontrem os profissionais mais adequados a cada pauta. Não tratamos dados pessoais privados (endereço residencial,
            telefone pessoal, dados familiares, opiniões políticas ou outros dados sensíveis).
          </p>
        </section>

        <section>
          <h2>2. Categorias, finalidades e bases legais</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="p-3">Categoria</th>
                  <th scope="col" className="p-3">Finalidade</th>
                  <th scope="col" className="p-3">Base legal</th>
                </tr>
              </thead>
              <tbody>
                {LEGAL_BASES.map((b) => (
                  <tr key={b.category} className="border-t align-top">
                    <td className="p-3 font-medium">{b.category}</td>
                    <td className="p-3 text-muted-foreground">{b.purpose}</td>
                    <td className="p-3 text-muted-foreground">{b.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2>3. Origem dos dados</h2>
          <p className="mt-2 text-muted-foreground">
            Cada informação é vinculada à sua fonte: páginas institucionais e expedientes de veículos, assinaturas em matérias
            publicadas, importações feitas por administradores (com a fonte informada) ou declaração do próprio jornalista. Não fazemos
            scraping de sites que proíbam acesso automatizado nem contornamos autenticação ou paywalls. Importações nunca são
            tratadas como verificadas automaticamente.
          </p>
        </section>

        <section>
          <h2>4. Quem acessa</h2>
          <p className="mt-2 text-muted-foreground">
            Apenas usuários autenticados. Contatos são exibidos conforme a visibilidade definida para cada um e com limite diário de
            consultas por usuário; exportações são limitadas e registradas. Administradores acessam dados para manutenção e revisão,
            com registro em logs de auditoria.
          </p>
        </section>

        <section>
          <h2>5. Seus direitos como titular</h2>
          <p className="mt-2 text-muted-foreground">
            Confirmação e acesso, correção, anonimização ou eliminação de dados desnecessários, oposição ao tratamento baseado em
            legítimo interesse, informação sobre compartilhamento e revisão de decisões automatizadas (art. 18 da LGPD). Jornalistas
            também podem <Link href="/reivindicar-perfil" className="text-info hover:underline">reivindicar o próprio perfil</Link> para
            atualizar dados e escolher o canal de contato preferido.
          </p>
        </section>

        <section>
          <h2>6. Retenção e segurança</h2>
          <p className="mt-2 text-muted-foreground">
            Mantemos o histórico profissional enquanto o perfil estiver ativo. Perfis ocultados por oposição deixam de aparecer nas
            buscas; pedidos de exclusão atendidos removem a ficha e os dados derivados, preservando apenas o registro mínimo da
            solicitação. O acesso aos dados é protegido por políticas de segurança no banco (RLS), validação no servidor e
            limites de uso.
          </p>
        </section>

        <section id="solicitacoes" className="rounded-lg border bg-surface p-6">
          <h2>7. Fazer uma solicitação</h2>
          {user ? (
            <div className="mt-4 grid gap-8 md:grid-cols-2">
              <PrivacyRequestForm defaultEmail={user.email} />
              <div>
                <h3 className="font-medium">Minhas solicitações</h3>
                {requests.length === 0 ? (
                  <p className="mt-2 text-muted-foreground">Nenhuma solicitação registrada.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {requests.map((r) => (
                      <li key={r.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{PRIVACY_REQUEST_TYPE_LABELS[r.request_type]}</span>
                          <Badge variant={r.status === "atendida" ? "success" : r.status === "recusada" ? "danger" : "outline"}>
                            {PRIVACY_STATUS_LABELS[r.status]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Aberta em {formatDate(r.created_at)}</p>
                        {r.resolution_notes ? <p className="mt-1 text-xs">{r.resolution_notes}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3 text-muted-foreground">
              <p>
                Entre na plataforma para registrar e acompanhar sua solicitação. Se você é jornalista e não tem conta, pode criar uma
                gratuitamente ou escrever para <a href={`mailto:${PRIVACY_EMAIL}`} className="text-info hover:underline">{PRIVACY_EMAIL}</a>.
              </p>
              <div className="flex gap-2">
                <Button asChild size="sm"><Link href="/login?next=/privacidade">Entrar</Link></Button>
                <Button asChild size="sm" variant="outline"><Link href="/cadastro">Criar conta</Link></Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
