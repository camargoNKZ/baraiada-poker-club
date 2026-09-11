import { createHash, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'baraiada_admin';

function expectedToken() {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!password || !secret) return '';
  return createHash('sha256').update(`${password}:${secret}`).digest('hex');
}

export function isAdminPassword(value: string) {
  const expected = process.env.ADMIN_PASSWORD ?? '';
  if (!value || !expected || value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export function isAdminSession(value?: string) {
  const expected = expectedToken();
  if (!value || !expected || value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export function createAdminSession() { return expectedToken(); }
