// Normalização e similaridade de nomes de pessoas (pt-BR).

const PARTICLES = new Set(["da", "de", "do", "das", "dos", "e", "d"]);

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameTokens(value: string | null | undefined): string[] {
  return normalizeText(value)
    .replace(/[.-]/g, " ")
    .split(" ")
    .filter((t) => t.length > 0 && !PARTICLES.has(t));
}

// Distância de Jaro-Winkler (0..1).
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return a.length === 0 ? 0 : 1;
  if (!a.length || !b.length) return 0;
  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

function tokenMatches(a: string, b: string): boolean {
  if (a === b) return true;
  // Abreviação: "e" casa com "exemplo"
  if (a.length === 1 && b.startsWith(a)) return true;
  if (b.length === 1 && a.startsWith(b)) return true;
  return a.length > 3 && b.length > 3 && jaroWinkler(a, b) >= 0.93;
}

// Similaridade de nomes considerando abreviações e partículas.
// Primeiro e último nome têm peso maior que nomes do meio.
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return 0;
  if (ta.join(" ") === tb.join(" ")) return 1;

  const firstMatch = tokenMatches(ta[0]!, tb[0]!);
  const lastMatch = tokenMatches(ta[ta.length - 1]!, tb[tb.length - 1]!);
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const used = new Set<number>();
  let matched = 0;
  for (const token of shorter) {
    const idx = longer.findIndex((t, i) => !used.has(i) && tokenMatches(token, t));
    if (idx >= 0) {
      used.add(idx);
      matched++;
    }
  }
  const coverage = matched / shorter.length;
  const structural = (firstMatch ? 0.35 : 0) + (lastMatch ? 0.35 : 0) + coverage * 0.3;
  const fuzzy = jaroWinkler(ta.join(" "), tb.join(" "));
  return Math.min(1, Math.max(structural, fuzzy * 0.85));
}
