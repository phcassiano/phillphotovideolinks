import "server-only";
import type { MailingVisibility } from "@/lib/domain/enums";
import { friendlyDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export interface MailingSummary {
  id: string;
  name: string;
  description: string | null;
  visibility: MailingVisibility;
  owner_id: string;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
}

export async function listMailings(): Promise<MailingSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mailing_lists")
    .select("id, name, description, visibility, owner_id, organization_id, created_at, updated_at, mailing_list_members(count)")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw friendlyDbError(error);
  return (data ?? []).map((m) => {
    const counts = m.mailing_list_members as unknown as { count: number }[] | null;
    return { ...(m as unknown as MailingSummary), member_count: counts?.[0]?.count ?? 0 };
  });
}

export interface MailingDetail extends Omit<MailingSummary, "member_count"> {
  members: { journalist_id: string; notes: string | null; added_at: string }[];
}

export async function getMailing(id: string): Promise<MailingDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mailing_lists")
    .select("id, name, description, visibility, owner_id, organization_id, created_at, updated_at, mailing_list_members(journalist_id, notes, added_at)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw friendlyDbError(error);
  if (!data) return null;
  const { mailing_list_members, ...rest } = data as unknown as MailingDetail & { mailing_list_members: MailingDetail["members"] };
  return { ...rest, members: mailing_list_members ?? [] };
}
