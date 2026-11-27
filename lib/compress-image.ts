// Reduz fotos no aparelho antes do envio (a Vercel aceita no máximo ~4,5 MB por requisição).
// Imagens viram JPEG com o lado maior em até 2000 px; PDFs e arquivos que o navegador não
// consegue abrir seguem como estão.
export async function compressImage(file: File, maxSide = 2000, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024 && file.type === 'image/jpeg') { bitmap.close(); return file; }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
