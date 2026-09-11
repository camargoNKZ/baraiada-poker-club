import { ADMIN_COOKIE, createAdminSession, isAdminPassword } from '@/lib/admin-auth';

export async function POST(request: Request) {
  const { password } = await request.json() as { password?: string };
  if (!isAdminPassword(password ?? '')) return Response.json({ error: 'Senha inválida.' }, { status: 401 });
  const response = Response.json({ ok: true });
  response.headers.append('Set-Cookie', `${ADMIN_COOKIE}=${createAdminSession()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  return response;
}

export async function DELETE() {
  const response = Response.json({ ok: true });
  response.headers.append('Set-Cookie', `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return response;
}
