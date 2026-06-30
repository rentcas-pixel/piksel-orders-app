export type ReplyLanguage = 'lt' | 'en';

const ENGLISH_WORDS =
  /\b(the|and|dear|thank|thanks|please|hello|hi|regards|your|you|we|our|this|that|with|for|from|attached|report|notes|team|order|product|sample|inspection|temporary|important|comments|download|hello)\b/gi;

const LITHUANIAN_WORDS =
  /\b(sveiki|labas|ačiū|aciu|dėkoju|dekoju|pagarbiai|laiškas|laiskas|prašau|prasau|mes|jūsų|jusu|sąskaita|saskaita|užsakym|uzsakym|gaut|siunč|siunc)\b/gi;

const LITHUANIAN_DIACRITICS = /[ąčęėįšųūž]/i;

export function detectReplyLanguage(
  subject: string | null | undefined,
  body: string | null | undefined
): ReplyLanguage {
  const text = `${subject ?? ''}\n${body ?? ''}`.trim();
  if (!text) return 'lt';

  const englishHits = (text.match(ENGLISH_WORDS) ?? []).length;
  const lithuanianHits = (text.match(LITHUANIAN_WORDS) ?? []).length;
  const hasLtDiacritics = LITHUANIAN_DIACRITICS.test(text);

  if (hasLtDiacritics || lithuanianHits > englishHits) {
    return 'lt';
  }

  if (englishHits >= 2) {
    return 'en';
  }

  // ASCII-only business mail without LT markers → English
  if (/[a-z]/i.test(text) && !hasLtDiacritics) {
    return 'en';
  }

  return 'lt';
}

export function getReplyLanguageLabel(language: ReplyLanguage): string {
  return language === 'en' ? 'English' : 'Lithuanian';
}

export function buildReplyLanguageInstruction(language: ReplyLanguage): string {
  if (language === 'en') {
    return [
      'LANGUAGE (highest priority): Write the entire reply in English only.',
      'Do not use Lithuanian words or sentences.',
      'Ignore any Lithuanian metadata in the prompt — match the original email language.',
    ].join(' ');
  }

  return [
    'LANGUAGE (highest priority): Write the entire reply in Lithuanian only.',
    'VOICE (highest priority): Kreipkis tujinimu — tu, tavo, gali, esi, norėtum. DRAUDŽIAMA: jūs, jūsų, -tumėte, -site formos.',
    'GREETING (highest priority): Pirmoji eilutė — „Labas Vardas,“ su KREIPINIU (Vyteni, Gediminai, Jonai). Formatas be kablelio po Labas. DRAUDŽIAMA: vardininkas (Vytenis), „Sveiki“.',
  ].join(' ');
}
