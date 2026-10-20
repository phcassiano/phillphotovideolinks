import type { Metadata } from "next";
import { JournalistForm } from "@/components/admin/journalist-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Novo jornalista" };

export default async function NewJournalistPage() {
  await requirePermission("admin.journalists");
  return (
    <>
      <PageHeader eyebrow="Administração" title="Novo jornalista" description="Após salvar, adicione vínculos, contatos e evidências. Cadastros entram como não verificados." />
      <Card><CardContent className="pt-5"><JournalistForm /></CardContent></Card>
    </>
  );
}
