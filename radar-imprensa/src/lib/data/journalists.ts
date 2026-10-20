import "server-only";
import type { ContactItem, JournalistCard, JournalistProfile, SearchResult } from "@/lib/domain/types";
import { friendlyDbError } from "@/lib/errors";
import { toRpcArgs, type SearchFilters } from "@/lib/search/filters";
import { createClient } from "@/lib/supabase/server";

export async function searchJournalists(filters: SearchFilters, pageSize?: number): Promise<SearchResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_journalists", toRpcArgs(filters, pageSize));
  if (error) throw friendlyDbError(error);
  return data as SearchResult;
}

export async function getJournalistProfile(id: string): Promise<JournalistProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_journalist_profile", { p_journalist_id: id });
  if (error) throw friendlyDbError(error);
  return (data as JournalistProfile | null) ?? null;
}

export async function getJournalistContacts(id: string): Promise<ContactItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_journalist_contacts", { p_journalist_id: id });
  if (error) throw friendlyDbError(error);
  return (data ?? []) as ContactItem[];
}

export async function getJournalistCards(ids: string[]): Promise<JournalistCard[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("journalist_cards", { p_ids: Array.from(new Set(ids)).slice(0, 500) });
  if (error) throw friendlyDbError(error);
  return (data ?? []) as JournalistCard[];
}

export async function getFavoriteIds(userId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("favorites").select("journalist_id").eq("user_id", userId).limit(5000);
  return new Set((data ?? []).map((f) => f.journalist_id as string));
}
