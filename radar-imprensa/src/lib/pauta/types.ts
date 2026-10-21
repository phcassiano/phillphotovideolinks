import type { JournalistSearchItem } from "@/lib/domain/types";

// "Encontrar jornalistas para minha pauta" — FASE 2 (desabilitada no MVP).
// O ranking é sempre feito sobre candidatos EXISTENTES no banco; nenhum
// componente (inclusive um modelo de IA) pode criar jornalistas ou contatos.

export interface PautaInterpretation {
  categorySlugs: string[]; // editorias/subeditorias identificadas
  stateCodes: string[]; // abrangência geográfica (vazio = nacional/indefinida)
  scope: "nacional" | "estadual" | "local" | "indefinida";
  keywords: string[]; // temas e entidades principais
  explanation: string[];
}

// Implementações possíveis: regras (abaixo) ou um adaptador de LLM futuro.
// Um adaptador de IA deve devolver APENAS esta estrutura, nunca nomes de pessoas.
export interface PautaInterpreter {
  readonly name: string;
  interpret(text: string): Promise<PautaInterpretation>;
}

export interface RankedCandidate {
  journalist: JournalistSearchItem;
  score: number;
  reasons: string[];
}
