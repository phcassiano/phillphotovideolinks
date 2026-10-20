import type { EvidenceType } from "@/lib/domain/enums";
import { normalizeText } from "@/lib/identity/names";
import type { ExtractedClaim, ExtractedEvidence, KnownOutlet, SearchResultItem, SourceExtractor } from "./types";
import { domainOf } from "./url";

const JOB_TITLES = [
  "editor-chefe",
  "editora-chefe",
  "chefe de reportagem",
  "reporter",
  "editor",
  "editora",
  "colunista",
  "correspondente",
  "apresentador",
  "apresentadora",
  "produtor",
  "produtora",
  "comentarista",
  "redator",
  "redatora",
];

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

function classify(url: string, text: string): EvidenceType {
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (/(expediente|equipe|quem-somos|redacao)/.test(path)) return "expediente";
  if (/(autor|author|colunista|perfil|profile)/.test(path)) return "perfil_institucional";
  if (/\bpor [a-z]+/.test(text)) return "assinatura_materia";
  return "busca_automatizada";
}

// Extrator heurístico sobre título e trecho fornecidos pela API de busca.
// Só reconhece veículos JÁ cadastrados (não cria veículos a partir de texto livre)
// e só registra e-mails literalmente presentes na fonte.
export class SnippetExtractor implements SourceExtractor {
  extract(result: SearchResultItem, context: { knownOutlets: KnownOutlet[] }): ExtractedEvidence {
    const text = normalizeText(`${result.title} ${result.snippet}`);
    const sourceDomain = domainOf(result.url);
    const claims: ExtractedClaim[] = [];

    const jobTitle = JOB_TITLES.find((t) => new RegExp(`\\b${t}\\b`).test(text)) ?? null;
    for (const outlet of context.knownOutlets) {
      const outletName = normalizeText(outlet.name);
      const outletDomain = domainOf(outlet.website);
      const byName = outletName.length >= 4 && text.includes(outletName);
      const byDomain = outletDomain !== null && sourceDomain !== null &&
        (sourceDomain === outletDomain || sourceDomain.endsWith(`.${outletDomain}`));
      if (byName || byDomain) {
        claims.push({ kind: "employment", outletId: outlet.id, outletName: outlet.name, jobTitle });
      }
    }

    const emails = new Set((`${result.title} ${result.snippet}`.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()));
    for (const email of emails) claims.push({ kind: "contact", contactType: "email_profissional", value: email });

    return { result, evidenceType: classify(result.url, text), claims, text, sourceDomain };
  }
}
