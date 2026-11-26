// Erros de regra de negócio levantados pelas funções do Postgres (RAISE ... ERRCODE 'P0001')
// já vêm com mensagem pronta para o usuário e devem virar HTTP 400, não 500.
export class BusinessError extends Error {}

export function throwIfError(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === 'P0001') throw new BusinessError(error.message);
  throw new Error(error.message);
}

export function errorResponse(error: unknown, fallback: string) {
  if (error instanceof BusinessError) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ error: error instanceof Error ? error.message : fallback }, { status: 500 });
}
