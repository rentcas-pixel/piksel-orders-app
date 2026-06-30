import { detectReplyLanguage } from '@/lib/email/email-language';
import { stripCorporateFluff } from '@/lib/email/email-writing-voice';
import { buildLithuanianGreeting } from '@/lib/email/lithuanian-vocative';
import type { ProcessedEmail } from '@/lib/email/types';

export const STRUCTURED_REPLY_RULE = `Structure the reply like a normal business email:
- Greeting on its own first line (e.g. "Dear Team," or "Labas Vyteni," / "Labas Gediminai,")
- Blank line after the greeting
- Short paragraphs (1-2 sentences each) separated by blank lines — prefer fewer paragraphs
- One main idea per paragraph
- Use real line breaks (\\n\\n) between sections
- Never put the entire reply in a single line
- If the answer fits in 5 sentences, do not write 10`;

export const LITHUANIAN_REPLY_VOICE_RULES = `Lietuviškuose atsakymuose (privaloma):
- Pirmoji eilutė: „Labas Vardas,“ — vardą rašyk KREIPINIU (kreipinys), ne vardininku: Vyteni, Gediminai, Jonai, Ona.
- Formatas: „Labas Vyteni,“ (be kablelio tarp Labas ir vardo).
- DRAUDŽIAMA: „Sveiki“, „Laba diena“, vardininkas (Vytenis, Gediminas).
- Kreipkis TIK tujinimu: tu, tavo, gali, esi, norėtum, atsiųsk, patvirtink.
- DRAUDŽIAMA: jūs, jūsų, jums, norėtumėte, galėtumėte, prašome, lauksime jūsų, esate, turite.
- Rašyk trumpai — be ilgų įžangų ir tuščių mandagybių po pasisveikinimo.
- Jei sprendimas aiškus — „padarysime“ / „patvirtinu“, ne „galėtume“ / „galime apsvarstyti“.`;

export interface DraftNormalizeContext {
  replyLanguage?: 'lt' | 'en';
  recipientFirstName?: string | null;
}

export function extractFirstName(
  fromName: string | null | undefined,
  fromAddress: string | null | undefined
): string | null {
  if (fromName?.trim()) {
    const first = fromName.trim().split(/\s+/)[0];
    if (first) return first;
  }
  if (fromAddress?.includes('@')) {
    const local = fromAddress.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
    if (local) {
      return local
        .split(/\s+/)[0]
        .replace(/^./, (char) => char.toUpperCase());
    }
  }
  return null;
}

export function getReplyFormattingRules(replyLanguage: 'lt' | 'en'): string {
  if (replyLanguage === 'lt') {
    return `${STRUCTURED_REPLY_RULE}\n\n${LITHUANIAN_REPLY_VOICE_RULES}`;
  }
  return STRUCTURED_REPLY_RULE;
}

const LT_FORMAL_TO_INFORMAL: Array<[RegExp, string]> = [
  [/\bLauksime jūsų\b/g, 'Lauksiu tavo'],
  [/\blauksime jūsų\b/g, 'lauksiu tavo'],
  [/\bprašome\b/g, 'prašau'],
  [/\bPrašome\b/g, 'Prašau'],
  [/\bnorėtumėte\b/g, 'norėtum'],
  [/\bNorėtumėte\b/g, 'Norėtum'],
  [/\bgalėtumėte\b/g, 'galėtum'],
  [/\bGalėtumėte\b/g, 'Galėtum'],
  [/\bgalėtume\b/g, 'padarysime'],
  [/\bGalėtume\b/g, 'Padarysime'],
  [/\bgalime apsvarstyti\b/g, 'padarysime'],
  [/\bGalime apsvarstyti\b/g, 'Padarysime'],
  [/\bapsvarstysime\b/g, 'padarysime'],
  [/\bApsvarstysime\b/g, 'Padarysime'],
  [/\batsakysite\b/g, 'atsakysi'],
  [/\bAtsakysite\b/g, 'Atsakysi'],
  [/\bpatvirtinkite\b/g, 'patvirtink'],
  [/\bPatvirtinkite\b/g, 'Patvirtink'],
  [/\bparašykite\b/g, 'parašyk'],
  [/\bParašykite\b/g, 'Parašyk'],
  [/\binformuokite\b/g, 'informuok'],
  [/\bInformuokite\b/g, 'Informuok'],
  [/\besate\b/g, 'esi'],
  [/\bEsate\b/g, 'Esi'],
  [/\bturite\b/g, 'turi'],
  [/\bTurite\b/g, 'Turi'],
  // jūsų prieš jūs — kitaip JS \\b „jūs“ atitinka „jūsų“ viduje ir gaunasi „Tuų“
  [/\bJūsų/g, 'Tavo'],
  [/\bjūsų/g, 'tavo'],
  [/\bJums\b/g, 'Tau'],
  [/\bjums\b/g, 'tau'],
  [/\bJūms\b/g, 'Tau'],
  [/\bjūms\b/g, 'tau'],
  [/\bjus\b/g, 'tu'],
  [/\bJus\b/g, 'Tu'],
  [/\bJūs\b(?!ų)/g, 'Tu'],
  [/\bjūs\b(?!ų)/g, 'tu'],
  [/\bTuų/g, 'Tavo'],
  [/\btuų/g, 'tavo'],
];

function applyLithuanianVoice(text: string, recipientFirstName: string | null): string {
  const greeting = buildLithuanianGreeting(recipientFirstName);

  let result = text.replace(/\r\n/g, '\n').trim();

  const greetingLineMatch = result.match(/^Labas,?\s+([^,\n]+),?\s*(?:\n|$)/i);
  if (greetingLineMatch) {
    const namePart = greetingLineMatch[1].trim();
    const fixedGreeting = buildLithuanianGreeting(namePart);
    result = result.replace(/^Labas,?\s+[^,\n]+,?\s*/i, `${fixedGreeting}\n\n`);
  } else {
    const greetingPatterns = [
      /^Sveiki,?\s*$/im,
      /^Laba diena,?\s*$/im,
      /^Gerbiam[ai],?\s*$/im,
      /^Labas,?\s*$/im,
      /^Sveiki,?\s*\n/i,
      /^Laba diena,?\s*\n/i,
      /^Gerbiam[ai],?\s*\n/i,
    ];

    let greetingFixed = false;
    for (const pattern of greetingPatterns) {
      if (pattern.test(result)) {
        result = result.replace(pattern, `${greeting}\n\n`);
        greetingFixed = true;
        break;
      }
    }

    if (!greetingFixed) {
      result = result.replace(/^(Sveiki|Laba diena|Gerbiam[ai]),?\s*/i, `${greeting}\n\n`);
    }
  }

  for (const [pattern, replacement] of LT_FORMAL_TO_INFORMAL) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

export function normalizeDraftFormatting(
  draft: string,
  context?: DraftNormalizeContext
): string {
  let text = draft.replace(/\r\n/g, '\n').trim();
  if (!text) return text;

  if (context?.replyLanguage === 'lt') {
    text = applyLithuanianVoice(text, context.recipientFirstName ?? null);
  }

  if (context?.replyLanguage) {
    text = stripCorporateFluff(text, context.replyLanguage);
  }

  text = text.replace(
    /^((?:Dear|Hello|Hi|Good morning|Good afternoon|Labas(?:\s+[^,\n]+)?|Sveiki|Laba diena)[^,\n]{0,100},?)\s+/i,
    '$1\n\n'
  );

  if (!text.includes('\n') && text.length > 140) {
    text = text.replace(/([.!?])\s+(?=[A-ZĄČĘĖĮŠŲŪŽ])/g, '$1\n\n');
  }

  text = text.replace(/:\s+-\s+/g, ':\n- ');
  text = text.replace(/;\s+-\s+/g, ';\n- ');

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export function normalizeEmailDraftReply(
  email: Pick<ProcessedEmail, 'subject' | 'body_text' | 'from_name' | 'from_address'>,
  draft: string
): string {
  const replyLanguage = detectReplyLanguage(email.subject, email.body_text);
  return normalizeDraftFormatting(draft, {
    replyLanguage,
    recipientFirstName: extractFirstName(email.from_name, email.from_address),
  });
}
