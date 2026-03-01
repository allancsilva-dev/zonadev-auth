export interface ApiError {
  message: string;
  code: string;
  details?: unknown;
}

export function getErrorMessage(error: unknown, fallback = 'Erro inesperado.'): string {
  if (error instanceof Error) return error.message;
  return fallback;
}
