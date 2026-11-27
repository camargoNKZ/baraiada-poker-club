import { BusinessError } from '@/lib/db-errors';
import { getSupabase } from '@/lib/supabase-server';

type Db = ReturnType<typeof getSupabase>;

// Comprovantes: bucket privado (link temporário). Fotos dos torneios: bucket público.
export const RECEIPTS_BUCKET = 'receipts';
export const PHOTOS_BUCKET = 'tournament-photos';

const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'application/pdf': 'pdf' };

// Erro de validação do arquivo: vira HTTP 400 com a mensagem para o usuário.
export class UploadError extends BusinessError {}

// Lê um arquivo opcional do formulário. Retorna null se nada foi enviado.
export function fileFrom(form: FormData, field: string): File | null {
  const value = form.get(field);
  return value instanceof File && value.size > 0 ? value : null;
}

export async function uploadFile(db: Db, bucket: string, folder: string, file: File, kind: 'receipt' | 'photo') {
  const allowed = kind === 'receipt' ? RECEIPT_TYPES : PHOTO_TYPES;
  // A Vercel limita o corpo da requisição em ~4,5 MB; as fotos são reduzidas no aparelho antes.
  const maxBytes = 4 * 1024 * 1024;
  if (!allowed.includes(file.type)) throw new UploadError(kind === 'receipt' ? 'Envie o comprovante como foto (JPG, PNG, WEBP, HEIC) ou PDF.' : 'Envie a foto em JPG, PNG, WEBP ou HEIC.');
  if (file.size > maxBytes) throw new UploadError(`Arquivo grande demais (máximo ${maxBytes / 1024 / 1024} MB).`);
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}.${EXT[file.type] ?? 'bin'}`;
  const { error } = await db.storage.from(bucket).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) throw new Error(`Não foi possível enviar o arquivo: ${error.message}`);
  return path;
}

// Link temporário (1 hora) para abrir um comprovante privado.
export async function receiptUrl(db: Db, path: string | null | undefined) {
  if (!path) return null;
  const { data } = await db.storage.from(RECEIPTS_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function photoUrl(path: string | null | undefined) {
  if (!path) return null;
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${PHOTOS_BUCKET}/${path}`;
}

// Saldo de cada jogador no torneio (cobrado − pago), considerando só lançamentos não estornados.
export async function balancesFor(db: Db, tournamentId: number) {
  const { data, error } = await db.from('financial_transactions').select('player_id, kind, total_amount, voided_at').eq('tournament_id', tournamentId);
  if (error) throw error;
  const balances = new Map<number, number>();
  for (const tx of data ?? []) {
    if (tx.voided_at) continue;
    balances.set(Number(tx.player_id), (balances.get(Number(tx.player_id)) ?? 0) + Number(tx.total_amount));
  }
  return balances;
}
