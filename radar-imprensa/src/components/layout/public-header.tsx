import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";

export function PublicHeader() {
  return (
    <header className="border-b bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="Radar de Imprensa — início">
          <Logo />
        </Link>
        <nav aria-label="Navegação pública" className="flex items-center gap-2">
          <Link href="/privacidade" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
            Privacidade
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/cadastro">Criar conta</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Radar de Imprensa. Dados profissionais tratados conforme a LGPD.</p>
        <nav aria-label="Links legais" className="flex gap-4">
          <Link href="/privacidade" className="hover:text-foreground">Política de privacidade</Link>
          <Link href="/termos" className="hover:text-foreground">Termos de uso</Link>
        </nav>
      </div>
    </footer>
  );
}
