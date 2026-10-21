// Formatos retornados pelas RPCs do banco (ver supabase/migrations/*_read_rpcs.sql).
import type {
  ContactType,
  ContactVisibility,
  EvidenceType,
  OutletType,
  ProfessionalStatus,
  VerificationStatus,
} from "./enums";

export interface CategoryRef {
  id: string;
  name: string;
  parent_id: string | null;
}

export interface LocationRef {
  id: string;
  state_code: string;
  state_name: string;
  city_name: string | null;
}

export interface OutletRef {
  id: string;
  name: string;
  outlet_type: OutletType | null;
  website: string | null;
}

export interface EmploymentSummary {
  id: string;
  job_title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  verification_status: VerificationStatus;
  last_verified_at: string | null;
  outlet: OutletRef;
  location: LocationRef | null;
  categories: CategoryRef[];
}

export interface JournalistSearchItem {
  id: string;
  full_name: string;
  professional_name: string | null;
  verification_status: VerificationStatus;
  professional_status: ProfessionalStatus;
  last_verified_at: string | null;
  profile_photo_url: string | null;
  matched_current: boolean;
  has_contact: boolean;
  current_employments: EmploymentSummary[];
}

export interface SearchResult {
  total: number;
  page: number;
  page_size: number;
  items: JournalistSearchItem[];
}

export interface EvidenceItem {
  id: string;
  source_url: string | null;
  source_title: string | null;
  observed_at: string | null;
  collected_at: string;
  evidence_type: EvidenceType;
  evidence_summary: string | null;
  review_status: "pendente" | "aceita" | "rejeitada";
  is_demo: boolean;
  related_entity_type: string | null;
}

export interface JournalistProfile {
  id: string;
  full_name: string;
  professional_name: string | null;
  biography: string | null;
  profile_photo_url: string | null;
  professional_status: ProfessionalStatus;
  verification_status: VerificationStatus;
  last_verified_at: string | null;
  last_checked_at: string | null;
  last_evidence_at: string | null;
  next_check_at: string | null;
  is_claimed: boolean;
  is_owner: boolean;
  is_hidden: boolean;
  merged_into_id: string | null;
  current_employments: EmploymentSummary[];
  past_employments: EmploymentSummary[];
  topics: { id: string; name: string; origin: string }[];
  evidence: EvidenceItem[];
  has_contact: boolean;
}

export interface ContactItem {
  id: string;
  contact_type: ContactType;
  contact_value: string;
  is_primary: boolean;
  visibility: ContactVisibility;
  professional_purpose: string | null;
  verification_status: VerificationStatus;
  last_verified_at: string | null;
  source_title: string | null;
  source_url: string | null;
  employment_id: string | null;
}

export interface JournalistCard {
  id: string;
  full_name: string;
  professional_name: string | null;
  verification_status: VerificationStatus;
  last_verified_at: string | null;
  is_available: boolean;
  current_employments: EmploymentSummary[];
}

export interface ExportRow {
  journalist_id: string;
  full_name: string;
  professional_name: string | null;
  outlet_names: string | null;
  job_titles: string | null;
  locations: string | null;
  categories: string | null;
  email: string | null;
  phone: string | null;
  contact_form: string | null;
  verification_status: VerificationStatus;
  last_verified_at: string | null;
  notes: string | null;
}
