"use server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { getCategories } from "@/lib/data/reference";
import { searchJournalists } from "@/lib/data/journalists";
import type { JournalistSearchItem } from "@/lib/domain/types";
import { serverEnv } from "@/lib/env.server";
import { actionError, type ActionResult } from "@/lib/errors";
import { rankCandidates } from "@/lib/pauta/ranker";
import { RuleBasedPautaInterpreter } from "@/lib/pauta/rule-interpreter";
import type { PautaInterpretation, RankedCandidate } from "@/lib/pauta/types";
import { DEFAULT_FILTERS } from "@/lib/search/filters";

export interface PautaResult {
  interpretation: PautaInterpretation;
  candidates: RankedCandidate[];
}

// Candidatos vêm EXCLUSIVAMENTE da busca no banco; o ranking só reordena.
export async function matchPauta(text: string): Promise<ActionResult<PautaResult>> {
  await requirePermission("journalists.search");
  if (!serverEnv.featurePautaMatching) return { ok: false, error: "Funcionalidade desabilitada (FEATURE_PAUTA_MATCHING)." };
  const parsed = z.string().trim().min(15, "Descreva a pauta com mais detalhes").max(3000).safeParse(text);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Texto inválido." };
  try {
    const interpretation = await new RuleBasedPautaInterpreter().interpret(parsed.data);
    const categories = await getCategories();
    const slugToId = new Map(categories.map((c) => [c.slug, c.id]));
    const idToSlug = new Map(categories.map((c) => [c.id, c.slug]));
    const categoryIds = interpretation.categorySlugs.map((s) => slugToId.get(s)).filter((v): v is string => Boolean(v));

    // Uma busca por estado (ou nacional), limitada, sobre vínculos atuais.
    const states = interpretation.stateCodes.length ? interpretation.stateCodes.slice(0, 3) : [undefined];
    const pool = new Map<string, JournalistSearchItem>();
    for (const uf of states) {
      for (const categoryId of categoryIds.length ? categoryIds.slice(0, 4) : [undefined]) {
        const result = await searchJournalists({ ...DEFAULT_FILTERS, editoria: categoryId, uf: uf as typeof DEFAULT_FILTERS.uf }, 50);
        for (const item of result.items) pool.set(item.id, item);
      }
    }
    return { ok: true, data: { interpretation, candidates: rankCandidates([...pool.values()], interpretation, idToSlug).slice(0, 30) } };
  } catch (error) {
    return actionError(error);
  }
}
