import type {
  ClaimMethod,
  ContactType,
  ContactVisibility,
  EvidenceType,
  InteractionType,
  JobStatus,
  MailingVisibility,
  OutletType,
  PrivacyRequestStatus,
  PrivacyRequestType,
  ProfessionalStatus,
  ProposalSource,
  ProposalStatus,
  UserRole,
  VerificationStatus,
} from "./enums";

export const ROLE_LABELS: Record<UserRole, string> = {
  assessor: "Assessor de imprensa",
  jornalista: "Jornalista",
  admin: "Administrador",
  super_admin: "Administrador principal",
};

export const OUTLET_TYPE_LABELS: Record<OutletType, string> = {
  tv: "TV",
  radio: "Rádio",
  jornal: "Jornal",
  portal: "Portal",
  revista: "Revista",
  agencia: "Agência",
  independente: "Independente",
};

export const PROFESSIONAL_STATUS_LABELS: Record<ProfessionalStatus, string> = {
  ativo: "Em atividade",
  freelancer: "Freelancer",
  afastado: "Afastado",
  inativo: "Fora da imprensa",
  desconhecido: "Situação desconhecida",
};

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  confirmado: "Confirmado",
  provavel: "Provável",
  nao_verificado: "Não verificado",
  desatualizado: "Desatualizado",
  em_revisao: "Em revisão",
};

export const VERIFICATION_DESCRIPTIONS: Record<VerificationStatus, string> = {
  confirmado: "Confirmado por revisão humana com evidência ou pelo próprio titular.",
  provavel: "Indícios consistentes, ainda sem confirmação formal.",
  nao_verificado: "Ainda não passou por verificação.",
  desatualizado: "A última confirmação é antiga; os dados podem ter mudado.",
  em_revisao: "Há alterações propostas aguardando revisão.",
};

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  email_profissional: "E-mail profissional",
  telefone_profissional: "Telefone profissional",
  whatsapp_profissional: "WhatsApp profissional (autorizado)",
  formulario_contato: "Formulário de contato",
};

export const CONTACT_VISIBILITY_LABELS: Record<ContactVisibility, string> = {
  assinantes: "Visível a usuários da plataforma",
  restrito: "Restrito (administração e titular)",
  oculto: "Oculto",
};

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  perfil_institucional: "Perfil institucional",
  assinatura_materia: "Assinatura em matéria",
  expediente: "Expediente",
  declaracao_titular: "Declaração do titular",
  importacao: "Importação",
  cadastro_manual: "Cadastro manual",
  busca_automatizada: "Busca automatizada",
  demonstrativa: "Demonstrativa (fictícia)",
};

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  email: "E-mail",
  telefone: "Telefone",
  reuniao: "Reunião",
  entrevista: "Entrevista",
  envio_release: "Envio de release",
  outro: "Outro",
};

export const PRIVACY_REQUEST_TYPE_LABELS: Record<PrivacyRequestType, string> = {
  acesso: "Acesso aos dados",
  correcao: "Correção",
  ocultacao: "Ocultação do perfil",
  exclusao: "Exclusão",
  oposicao: "Oposição ao tratamento",
};

export const PRIVACY_STATUS_LABELS: Record<PrivacyRequestStatus, string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  atendida: "Atendida",
  recusada: "Recusada",
};

export const CLAIM_METHOD_LABELS: Record<ClaimMethod, string> = {
  email_corporativo: "E-mail corporativo do veículo",
  documento_profissional: "Documento profissional",
  contato_redacao: "Confirmação pela redação",
  outro: "Outro",
};

export const MAILING_VISIBILITY_LABELS: Record<MailingVisibility, string> = {
  privada: "Privada (somente eu)",
  organizacao: "Compartilhada com minha organização",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  agendada: "Agendada",
  executando: "Em execução",
  concluida: "Concluída",
  falhou: "Falhou",
  ignorada: "Ignorada",
  cancelada: "Cancelada",
};

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
};

export const PROPOSAL_SOURCE_LABELS: Record<ProposalSource, string> = {
  verificacao_automatica: "Verificação automática",
  sugestao_usuario: "Sugestão de usuário",
  titular: "Titular do perfil",
  importacao: "Importação",
  admin: "Administração",
};
