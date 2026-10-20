// Valores espelhados dos tipos enumerados do banco (supabase/migrations).

export const USER_ROLES = ["assessor", "jornalista", "admin", "super_admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const OUTLET_TYPES = ["tv", "radio", "jornal", "portal", "revista", "agencia", "independente"] as const;
export type OutletType = (typeof OUTLET_TYPES)[number];

export const PROFESSIONAL_STATUSES = ["ativo", "freelancer", "afastado", "inativo", "desconhecido"] as const;
export type ProfessionalStatus = (typeof PROFESSIONAL_STATUSES)[number];

export const VERIFICATION_STATUSES = [
  "confirmado",
  "provavel",
  "nao_verificado",
  "desatualizado",
  "em_revisao",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const CONTACT_TYPES = [
  "email_profissional",
  "telefone_profissional",
  "whatsapp_profissional",
  "formulario_contato",
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const CONTACT_VISIBILITIES = ["assinantes", "restrito", "oculto"] as const;
export type ContactVisibility = (typeof CONTACT_VISIBILITIES)[number];

export const EVIDENCE_TYPES = [
  "perfil_institucional",
  "assinatura_materia",
  "expediente",
  "declaracao_titular",
  "importacao",
  "cadastro_manual",
  "busca_automatizada",
  "demonstrativa",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const INTERACTION_TYPES = ["email", "telefone", "reuniao", "entrevista", "envio_release", "outro"] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const PRIVACY_REQUEST_TYPES = ["acesso", "correcao", "ocultacao", "exclusao", "oposicao"] as const;
export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];

export const PRIVACY_REQUEST_STATUSES = ["aberta", "em_analise", "atendida", "recusada"] as const;
export type PrivacyRequestStatus = (typeof PRIVACY_REQUEST_STATUSES)[number];

export const CLAIM_METHODS = ["email_corporativo", "documento_profissional", "contato_redacao", "outro"] as const;
export type ClaimMethod = (typeof CLAIM_METHODS)[number];

export const MAILING_VISIBILITIES = ["privada", "organizacao"] as const;
export type MailingVisibility = (typeof MAILING_VISIBILITIES)[number];

export const JOB_STATUSES = ["agendada", "executando", "concluida", "falhou", "ignorada", "cancelada"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const PROPOSAL_STATUSES = ["pendente", "aprovada", "rejeitada", "cancelada"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const PROPOSAL_SOURCES = ["verificacao_automatica", "sugestao_usuario", "titular", "importacao", "admin"] as const;
export type ProposalSource = (typeof PROPOSAL_SOURCES)[number];
