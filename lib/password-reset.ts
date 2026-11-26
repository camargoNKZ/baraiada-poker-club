import { createHash, randomInt } from 'node:crypto';

// Código de redefinição de senha gerado por um administrador.
// 10 caracteres sem letras/números ambíguos (sem 0/O, 1/I/L): ~8×10^14 combinações.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const RESET_CODE_TTL_MS = 24 * 60 * 60 * 1000;

export function generateResetCode() {
  let code = '';
  for (let i = 0; i < 10; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

// Aceita o código com ou sem hífen, maiúsculo ou minúsculo.
export function normalizeResetCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashResetCode(code: string) {
  return createHash('sha256').update(normalizeResetCode(code)).digest('hex');
}
