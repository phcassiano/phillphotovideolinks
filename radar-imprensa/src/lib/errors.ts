// Tradução de erros do banco/PostgREST para mensagens amigáveis.

export interface DbErrorLike {
  code?: string;
  message?: string;
  hint?: string | null;
  details?: string | null;
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly kind: "auth" | "forbidden" | "not_found" | "validation" | "rate_limited" | "config" | "unknown",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function friendlyDbError(error: DbErrorLike | null | undefined): AppError {
  if (!error) return new AppError("Erro desconhecido.", "unknown");
  const message = error.message ?? "";
  switch (error.code) {
    case "P0429":
      return new AppError(message || "Limite de uso excedido. Tente novamente mais tarde.", "rate_limited");
    case "28000":
      return new AppError("Sua sessão expirou. Entre novamente.", "auth");
    case "42501":
      return new AppError(message || "Você não tem permissão para esta ação.", "forbidden");
    case "P0002":
      return new AppError(message || "Registro não encontrado.", "not_found");
    case "22023":
    case "23514":
    case "22P02":
      return new AppError(message || "Dados inválidos.", "validation");
    case "23505":
      return new AppError("Já existe um registro com esses dados.", "validation");
    case "23503":
      return new AppError("Registro relacionado não encontrado.", "validation");
    default:
      return new AppError("Não foi possível concluir a operação. Tente novamente.", "unknown");
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function actionError(error: unknown): { ok: false; error: string } {
  if (error instanceof AppError) return { ok: false, error: error.message };
  if (error && typeof error === "object" && "code" in error) {
    return { ok: false, error: friendlyDbError(error as DbErrorLike).message };
  }
  console.error(error);
  return { ok: false, error: "Erro inesperado. Tente novamente." };
}
