/** Saugius Supabase Storage kelius (tik ASCII, be lietuviškų raidžių). */
export function sanitizeStorageKeySegment(value: string, maxLength = 80): string {
  const ascii = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  return (ascii || 'file').slice(0, maxLength);
}

/** Mistral OCR failų įkėlimui — be tarpų ir specialių simbolių. */
export function sanitizeMistralUploadFilename(filename: string): string {
  const dot = filename.lastIndexOf('.');
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : '.pdf';
  const stem = dot >= 0 ? filename.slice(0, dot) : filename;
  const safeStem = sanitizeStorageKeySegment(stem) || 'invoice';
  return `${safeStem}${ext}`;
}
