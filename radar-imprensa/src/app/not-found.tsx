import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="conteudo" className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-accent">Erro 404</p>
      <h1 className="text-2xl font-semibold text-primary">Página não encontrada</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        O endereço pode estar incorreto, ou o registro foi removido ou ocultado a pedido do titular.
      </p>
      <Button asChild>
        <Link href="/dashboard">Voltar à visão geral</Link>
      </Button>
    </main>
  );
}
