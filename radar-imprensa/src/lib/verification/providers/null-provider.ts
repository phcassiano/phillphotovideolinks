import type { SearchProvider, SearchResultItem } from "../types";

// Usado quando nenhuma integração está configurada: o app continua funcionando
// e as verificações são registradas como "ignoradas" (sem simular resultados).
export class NullSearchProvider implements SearchProvider {
  readonly name = "nenhum";
  readonly isConfigured = false;
  readonly isDemo = false;

  async search(): Promise<SearchResultItem[]> {
    return [];
  }
}
