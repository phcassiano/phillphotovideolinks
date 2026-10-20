import { normalizeText } from "@/lib/identity/names";
import { STATES } from "@/lib/csv/states";
import type { PautaInterpretation, PautaInterpreter } from "./types";

// Dicionário transparente de termos -> editorias (slugs de editorial_categories).
const CATEGORY_TERMS: Record<string, string[]> = {
  politica: ["politica", "governo", "eleicao", "eleicoes", "partido", "prefeito", "governador", "deputado", "vereador", "senador"],
  "congresso-nacional": ["congresso", "camara dos deputados", "senado", "projeto de lei", "pl ", "votacao", "plenario"],
  "politica-local": ["assembleia legislativa", "camara municipal", "prefeitura", "vereador"],
  economia: ["economia", "inflacao", "juros", "pib", "mercado", "imposto", "tributario", "emprego", "renda"],
  "mercado-financeiro": ["bolsa", "acoes", "investimento", "banco central", "selic"],
  agronegocio: ["agronegocio", "safra", "agricultura", "pecuaria"],
  cultura: ["cultura", "cultural", "artista", "show", "festival", "museu", "teatro", "lei de incentivo", "rouanet"],
  musica: ["musica", "show", "album", "cantor", "cantora"],
  cinema: ["cinema", "filme", "audiovisual"],
  literatura: ["livro", "literatura", "escritor", "editora"],
  cidades: ["cidade", "bairro", "transito", "saneamento", "urbano", "obras"],
  "mobilidade-urbana": ["transporte publico", "onibus", "metro", "mobilidade"],
  policia: ["policia", "crime", "prisao", "investigacao policial", "homicidio"],
  "seguranca-publica": ["seguranca publica", "violencia"],
  esportes: ["esporte", "campeonato", "atleta", "olimpiada"],
  futebol: ["futebol", "clube", "gol", "brasileirao"],
  saude: ["saude", "hospital", "sus", "vacina", "doenca", "medico"],
  educacao: ["educacao", "escola", "universidade", "enem", "professor", "ensino"],
  tecnologia: ["tecnologia", "inteligencia artificial", "software", "internet", "digital", "dados"],
  "inovacao-startups": ["startup", "inovacao", "empreendedorismo"],
  "meio-ambiente": ["meio ambiente", "ambiental", "desmatamento", "sustentabilidade", "amazonia"],
  clima: ["clima", "climatica", "aquecimento global", "carbono", "cop"],
  entretenimento: ["novela", "celebridade", "reality", "televisao"],
  justica: ["justica", "tribunal", "stf", "stj", "juiz", "processo judicial", "ministerio publico"],
  internacional: ["internacional", "exterior", "diplomacia", "onu", "relacoes exteriores"],
};

const NATIONAL_TERMS = ["congresso nacional", "nacional", "brasil", "federal", "pais", "senado", "camara dos deputados", "stf"];
const LOCAL_TERMS = ["municipal", "prefeitura", "camara municipal", "bairro", "vereador"];

const AMBIGUOUS_STATE_NAMES = new Set(["para"]);

const STOPWORDS = new Set([
  "a", "o", "os", "as", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "por", "para",
  "com", "sobre", "que", "um", "uma", "sera", "ser", "foi", "ao", "aos", "se", "mais", "seu", "sua",
]);

export class RuleBasedPautaInterpreter implements PautaInterpreter {
  readonly name = "regras";

  async interpret(text: string): Promise<PautaInterpretation> {
    const normalized = ` ${normalizeText(text)} `;
    const explanation: string[] = [];

    const categorySlugs: string[] = [];
    for (const [slug, terms] of Object.entries(CATEGORY_TERMS)) {
      const hit = terms.find((t) => normalized.includes(` ${t.trim()}`));
      if (hit) {
        categorySlugs.push(slug);
        explanation.push(`Termo "${hit.trim()}" indica a editoria "${slug}".`);
      }
    }

    const stateCodes: string[] = [];
    for (const [code, name] of Object.entries(STATES)) {
      const n = normalizeText(name);
      // "Pará" coincide com a preposição "para": exige "do/no/estado do Pará".
      const found = AMBIGUOUS_STATE_NAMES.has(n)
        ? [" do ", " no ", " estado do "].some((p) => normalized.includes(`${p}${n} `))
        : normalized.includes(` ${n} `);
      if (found) {
        stateCodes.push(code);
        explanation.push(`Menção a "${name}" indica abrangência estadual.`);
      }
    }

    let scope: PautaInterpretation["scope"] = "indefinida";
    if (NATIONAL_TERMS.some((t) => normalized.includes(t))) scope = "nacional";
    else if (LOCAL_TERMS.some((t) => normalized.includes(t))) scope = "local";
    else if (stateCodes.length) scope = "estadual";
    if (scope !== "indefinida") explanation.push(`Abrangência estimada: ${scope}.`);

    const keywords = Array.from(
      new Set(normalizeText(text).split(" ").filter((w) => w.length > 3 && !STOPWORDS.has(w))),
    ).slice(0, 12);

    return { categorySlugs, stateCodes, scope, keywords, explanation };
  }
}
