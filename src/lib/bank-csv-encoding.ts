/** Swedbank CSV dažnai Windows-1257 / ISO-8859-13, bet naršyklė skaito kaip UTF-8 → „ÐKLËRIAI“ vietoj „ŠKLĖRIAI“. */

const MOJIBAKE_MARKERS = /ÐKL|ËRIAI|ÈIØ|Ã.|Â.|Ä.|Å.|Ø|ø|Ý|ý|IÁ|Ë|Ð/;

/** Pataiso žinomus sugadintus tiekėjų pavadinimus į kanoninę formą. */
export function normalizeKnownCompanyText(text: string): string {
  return text
    .replace(/UAB\s*\.?\s*\.?\s*ŠKLĖRIAI"?/gi, 'UAB Šklėriai')
    .replace(/UAB\s*\.?\s*(?:[.\s\u00D0]*)?KL[ËEÈeėë]RIAI"?/gi, 'UAB Šklėriai')
    .replace(/UAB\s*\.?\s*SKLERIAI/gi, 'UAB Šklėriai');
}

export function fixBalticMojibake(text: string): string {
  const fixed = text
    .replace(/\u00C5\u00A1/g, 'š')
    .replace(/\u00C4\u0085/g, 'ą')
    .replace(/\u00C4\u008D/g, 'č')
    .replace(/\u00C4\u0099/g, 'ę')
    .replace(/\u00C4\u0097/g, 'ė')
    .replace(/\u00C4\u00AF/g, 'į')
    .replace(/\u00C5\u00AB/g, 'ū')
    .replace(/\u00C5\u00B3/g, 'ų')
    .replace(/\u00C5\u00BE/g, 'ž')
    .replace(/Ã…Â¡/g, 'š')
    .replace(/Ã„Â…/g, 'ą')
    .replace(/Ã„Â/g, 'č')
    .replace(/Ã„Â™/g, 'ę')
    .replace(/Ã„Â—/g, 'ė')
    .replace(/Ã„Â¯/g, 'į')
    .replace(/Ã…Â«/g, 'ū')
    .replace(/Ã…Â³/g, 'ų')
    .replace(/Ã…Â¾/g, 'ž');

  return normalizeKnownCompanyText(fixed);
}

function hasMojibake(text: string): boolean {
  return MOJIBAKE_MARKERS.test(text);
}

function lithuanianLetterScore(text: string): number {
  const matches = text.match(/[ąčęėįšųūžĄČĘĖĮŠŲŪŽ]/g);
  return matches?.length ?? 0;
}

export function decodeBankCsvBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const candidates: string[] = [];

  const push = (label: string, value: string) => {
    candidates.push(fixBalticMojibake(value.replace(/^\uFEFF/, '')));
  };

  push('utf-8', new TextDecoder('utf-8').decode(bytes));

  for (const encoding of ['windows-1257', 'iso-8859-13', 'windows-1252', 'latin1']) {
    try {
      push(encoding, new TextDecoder(encoding).decode(bytes));
    } catch {
      // ignore unsupported encodings
    }
  }

  candidates.sort((a, b) => {
    const aBad = hasMojibake(a) ? -1000 : 0;
    const bBad = hasMojibake(b) ? -1000 : 0;
    const aScore = aBad + lithuanianLetterScore(a) + (/\bUAB\b/i.test(a) ? 5 : 0);
    const bScore = bBad + lithuanianLetterScore(b) + (/\bUAB\b/i.test(b) ? 5 : 0);
    return bScore - aScore;
  });

  return candidates[0] ?? '';
}

export async function readBankCsvFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return decodeBankCsvBytes(buffer);
}

export function isGarbledSkleriaiText(text: string | null | undefined): boolean {
  if (!text) return false;
  return /KL[ËEÈeėë]RIAI/i.test(text) || /ÐKL/i.test(text) || /\.ŠKL/i.test(text);
}

export function canonicalSkleriaiName(): string {
  return 'UAB Šklėriai';
}
