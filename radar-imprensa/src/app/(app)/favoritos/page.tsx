import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { AddToMailingDialog } from "@/components/journalists/add-to-mailing-dialog";
import { JournalistCardRow } from "@/components/journalists/journalist-card-row";
import { RemoveFavoriteButton } from "@/components/journalists/remove-favorite-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth/session";
import { getJournalistCards } from "@/lib/data/journalists";
import { listMailings } from "@/lib/data/mailings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Favoritos" };

export default async function FavoritesPage() {
  const user = await requirePermission("favorites.manage");
  const supabase = await createClient();
  const { data: favorites } = await supabase
    .from("favorites")
    .select("journalist_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);
  const ids = (favorites ?? []).map((f) => f.journalist_id as string);
  const [cards, mailings] = await Promise.all([getJournalistCards(ids), listMailings()]);
  const ownMailings = mailings.filter((m) => m.owner_id === user.id).map((m) => ({ id: m.id, name: m.name }));
  const availableIds = cards.filter((c) => c.is_available).map((c) => c.id);

  return (
    <>
      <PageHeader
        title="Favoritos"
        description="Perfis salvos para acesso rápido."
        actions={cards.length ? <AddToMailingDialog journalistIds={availableIds} mailings={ownMailings} /> : null}
      />
      {cards.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Nenhum favorito ainda"
          description="Use a estrela nos resultados de busca ou no perfil de um jornalista para salvá-lo aqui."
          action={
            <Button asChild>
              <Link href="/jornalistas">Buscar jornalistas</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => (
            <li key={card.id}>
              <JournalistCardRow card={card}>
                <RemoveFavoriteButton journalistId={card.id} />
              </JournalistCardRow>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
