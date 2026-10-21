"use client";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-lg border border-danger/30 bg-danger-soft p-6 text-center">
      <TriangleAlert className="mx-auto mb-3 size-8 text-danger" aria-hidden />
      <h2 className="text-lg font-semibold">Algo deu errado ao carregar esta página</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tente novamente. Se o problema persistir, informe o código {error.digest ? <code>{error.digest}</code> : "exibido no console"} ao suporte.
      </p>
      <Button className="mt-4" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
