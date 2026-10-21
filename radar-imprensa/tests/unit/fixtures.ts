import type { EmploymentSummary, JournalistSearchItem } from "@/lib/domain/types";
import type { ClaimedJob, JobOutcome, JournalistSnapshot, KnownOutlet, VerificationRepository } from "@/lib/verification/types";

export const OUTLETS: KnownOutlet[] = [
  { id: "o-portal-pi", name: "Portal Exemplo Piauí", website: "https://portal-exemplo-pi.example", outlet_type: "portal" },
  { id: "o-gazeta", name: "Gazeta Fictícia do Piauí", website: "https://gazeta-ficticia.example", outlet_type: "jornal" },
  { id: "o-diario-rj", name: "Diário Exemplo Carioca", website: "https://diario-exemplo-carioca.example", outlet_type: "jornal" },
];

export function employment(id: string, outletId: string, extra: Partial<EmploymentSummary> = {}): EmploymentSummary {
  const outlet = OUTLETS.find((o) => o.id === outletId)!;
  return {
    id,
    job_title: "Repórter",
    start_date: null,
    end_date: null,
    is_current: true,
    verification_status: "confirmado",
    last_verified_at: null,
    outlet: { id: outlet.id, name: outlet.name, outlet_type: outlet.outlet_type, website: outlet.website },
    location: { id: "l-the", state_code: "PI", state_name: "Piauí", city_name: "Teresina" },
    categories: [{ id: "c-pol", name: "Política", parent_id: null }],
    ...extra,
  };
}

export function snapshot(extra: Partial<JournalistSnapshot> = {}): JournalistSnapshot {
  return {
    id: "j-ana",
    full_name: "Ana Exemplo Ribeiro",
    professional_name: "Ana Ribeiro",
    verification_status: "provavel",
    last_verified_at: null,
    current_employments: [employment("e-1", "o-portal-pi")],
    past_employments: [],
    contacts: [{ id: "ct-1", contact_type: "email_profissional", contact_value: "ana.ribeiro@portal-exemplo-pi.example", verification_status: "confirmado" }],
    identifiers: [],
    ...extra,
  };
}

export class MemoryRepository implements VerificationRepository {
  outcomes: { jobId: string; outcome: JobOutcome }[] = [];
  constructor(
    public jobs: ClaimedJob[],
    public snapshots: Record<string, JournalistSnapshot>,
    public outlets: KnownOutlet[] = OUTLETS,
  ) {}
  async claimJobs(n: number) {
    return this.jobs.splice(0, n);
  }
  async getSnapshot(id: string) {
    return this.snapshots[id] ?? null;
  }
  async listKnownOutlets() {
    return this.outlets;
  }
  async recordOutcome(jobId: string, outcome: JobOutcome) {
    this.outcomes.push({ jobId, outcome });
  }
}

export function searchItem(id: string, name: string, employments: EmploymentSummary[], extra: Partial<JournalistSearchItem> = {}): JournalistSearchItem {
  return {
    id,
    full_name: name,
    professional_name: null,
    verification_status: "confirmado",
    professional_status: "ativo",
    last_verified_at: null,
    profile_photo_url: null,
    matched_current: true,
    has_contact: false,
    current_employments: employments,
    ...extra,
  };
}
