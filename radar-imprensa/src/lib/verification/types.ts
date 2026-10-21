import type { ChangeOp } from "@/lib/confidence/policy";
import type { EvidenceType, OutletType, VerificationStatus } from "@/lib/domain/enums";
import type { EmploymentSummary } from "@/lib/domain/types";

// -----------------------------------------------------------------------------
// Contratos do módulo de verificação periódica. Integrações externas ficam
// atrás destas interfaces para poderem ser trocadas sem alterar o serviço.
// -----------------------------------------------------------------------------

export interface JournalistSnapshot {
  id: string;
  full_name: string;
  professional_name: string | null;
  verification_status: VerificationStatus;
  last_verified_at: string | null;
  current_employments: EmploymentSummary[];
  past_employments: EmploymentSummary[];
  contacts: { id: string; contact_type: string; contact_value: string; verification_status: VerificationStatus }[];
  identifiers: { identifier_type: string; identifier_value: string }[];
}

export interface KnownOutlet {
  id: string;
  name: string;
  website: string | null;
  outlet_type: OutletType | null;
}

export interface SearchQuery {
  journalistId: string;
  text: string;
}

export interface SearchResultItem {
  url: string;
  title: string;
  snippet: string;
  publishedAt?: string | null;
  provider: string;
  isDemo?: boolean;
}

// Busca em fontes autorizadas (APIs oficiais). Nunca faz scraping.
export interface SearchProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  readonly isDemo: boolean;
  search(query: SearchQuery, signal?: AbortSignal): Promise<SearchResultItem[]>;
}

export type ExtractedClaim =
  | { kind: "employment"; outletId: string; outletName: string; jobTitle: string | null }
  | { kind: "contact"; contactType: "email_profissional"; value: string };

export interface ExtractedEvidence {
  result: SearchResultItem;
  evidenceType: EvidenceType;
  claims: ExtractedClaim[];
  text: string; // texto normalizado analisado (título + trecho)
  sourceDomain: string | null;
}

export interface SourceExtractor {
  extract(result: SearchResultItem, context: { knownOutlets: KnownOutlet[] }): ExtractedEvidence;
}

export interface ResolutionResult {
  matches: boolean;
  confidence: number;
  reasons: string[];
}

// Decide se uma evidência se refere à MESMA pessoa do registro.
export interface EntityResolver {
  resolve(snapshot: JournalistSnapshot, evidence: ExtractedEvidence): ResolutionResult;
}

export interface ResolvedEvidence extends ExtractedEvidence {
  resolution: ResolutionResult;
}

export interface DetectedChanges {
  changes: ChangeOp[];
  corroboratedEmploymentIds: string[];
  confidence: number;
  description: string;
}

export interface ChangeDetector {
  detect(snapshot: JournalistSnapshot, evidences: ResolvedEvidence[]): DetectedChanges;
}

export interface ClaimedJob {
  id: string;
  journalist_id: string;
  attempts: number;
}

export interface EvidencePayload {
  source_url: string;
  source_title: string;
  observed_at: string | null;
  evidence_type: EvidenceType;
  evidence_summary: string;
  confidence_score: number;
  related_entity_type: "journalist" | "employment" | "contact";
  related_entity_id: string | null;
  is_demo: boolean;
}

export interface ProposalPayload {
  proposed_changes: ChangeOp[];
  confidence_score: number;
  description: string;
  sensitive: boolean;
  is_demo: boolean;
}

export type JobOutcome =
  | {
      outcome: "concluida";
      provider: string;
      evidence: EvidencePayload[];
      proposal: ProposalPayload | null;
      summary: Record<string, unknown>;
    }
  | { outcome: "ignorada"; provider: string; reason: string }
  | { outcome: "falhou"; provider: string; error: string };

export interface VerificationRepository {
  claimJobs(batchSize: number): Promise<ClaimedJob[]>;
  getSnapshot(journalistId: string): Promise<JournalistSnapshot | null>;
  listKnownOutlets(): Promise<KnownOutlet[]>;
  recordOutcome(jobId: string, outcome: JobOutcome): Promise<void>;
}

export interface BatchReport {
  claimed: number;
  completed: number;
  skipped: number;
  failed: number;
  proposals: number;
  evidence: number;
  details: { jobId: string; journalistId: string; outcome: JobOutcome["outcome"]; message?: string }[];
}
