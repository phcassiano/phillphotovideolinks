"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { actionError, type ActionResult } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { privacyRequestSchema } from "@/lib/validation/forms";

export async function submitPrivacyRequest(input: z.input<typeof privacyRequestSchema>): Promise<ActionResult> {
  await requireUser();
  const parsed = privacyRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revise os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_privacy_request", {
    p_type: parsed.data.requestType,
    p_details: parsed.data.details,
    p_journalist_id: parsed.data.journalistId ?? null,
    p_contact_email: parsed.data.contactEmail ?? null,
  });
  if (error) return actionError(error);
  revalidatePath("/privacidade");
  return { ok: true, message: "Solicitação registrada. Responderemos em até 15 dias, conforme a LGPD." };
}
