import type { SupabaseClient } from "@supabase/supabase-js";
import type { VerificationProviderName } from "@/lib/env.server";
import { EvidenceChangeDetector } from "./detector";
import { SnippetExtractor } from "./extractor";
import { BraveSearchProvider } from "./providers/brave-provider";
import { DemoSearchProvider } from "./providers/demo-provider";
import { NullSearchProvider } from "./providers/null-provider";
import { ConservativeEntityResolver } from "./resolver";
import { VerificationService } from "./service";
import { SupabaseVerificationRepository } from "./supabase-repository";
import type { SearchProvider } from "./types";

export function createVerificationService(
  db: SupabaseClient,
  config: { provider: VerificationProviderName; braveApiKey?: string },
): VerificationService {
  const repository = new SupabaseVerificationRepository(db);
  let provider: SearchProvider;
  switch (config.provider) {
    case "demo":
      provider = new DemoSearchProvider(repository);
      break;
    case "brave":
      provider = new BraveSearchProvider(config.braveApiKey);
      break;
    default:
      provider = new NullSearchProvider();
  }
  return new VerificationService({
    provider,
    extractor: new SnippetExtractor(),
    resolver: new ConservativeEntityResolver(),
    detector: new EvidenceChangeDetector(),
    repository,
  });
}
