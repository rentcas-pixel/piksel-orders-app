import type { ReplyLanguage } from '@/lib/email/email-language';

export const RENATAS_WRITING_PRINCIPLES_LT = `Rašymo principai (privaloma laikytis):

Tikslas — ne skambėti mandagiausiai ar formaliausiai, o greitai, aiškiai ir profesionaliai išspręsti klausimą.

- Rašyk trumpai. Kiekvienas sakinys turi turėti prasmę.
- Nerašyk ilgų įžangų ir nereikalingų mandagybių.
- Nevartok korporacinio „vandens“ ir tuščių frazių.
- Jei mintį galima pasakyti vienu sakiniu vietoje trijų — rinkis vieną.
- Būk mandagus, bet tvirtas.
- Jei sprendimas priimtas — rašyk „padarysime“, o ne „galėtume“, „galime“ ar „apsvarstysime“.
- Jei yra problema — įvardyk ją aiškiai ir iš karto pasiūlyk sprendimą.
- Nevenk pasakyti, kad kita pusė klysta, bet korektiškai ir be emocijų.
- Jei remiesi sutartimi — nurodyk konkretų punktą.
- Nerašyk to, kas akivaizdu gavėjui.
- Nenaudok dirbtinai gražių ar pompastiškų sakinių.

Tonas: ramus, profesionalus, konkretus, orientuotas į rezultatą, pasitikintis savimi, bet ne arogantiškas.

Prieš rašant paklausk savęs:
- Ar šį sakinį galima sutrumpinti?
- Ar ši informacija iš tiesų reikalinga?
- Ar vietoje „galime“ reikėtų rašyti „padarysime“?
- Ar gavėjui aišku, koks kitas žingsnis?

Nerašyk kaip tipinis ChatGPT.

Venk lietuviškų frazių:
- tikiuosi, kad viskas gerai / tikiuosi, kad jums sekasi
- dėkojame už kantrybę / labai dėkojame už supratingumą
- nedvejodami kreipkitės / rašykite bet kada
- labai vertiname jūsų / mes labai vertiname
- būtume malonu / džiaugtumėmės galėdami
- maloniai prašome / prašome atkreipti dėmesį
- norime informuoti / informuojame, kad
- norėtume pasidžiaugti / džiaugiamės galėdami pranešti
- kaip žinote / kaip jums žinoma
- be abejo / neabejotinai sutinkame`;

export const RENATAS_WRITING_PRINCIPLES_EN = `Writing principles (mandatory):

The goal is not to sound overly polite or formal — it is to resolve the issue quickly, clearly, and professionally.

- Write briefly. Every sentence must earn its place.
- No long intros or unnecessary pleasantries.
- No corporate filler or empty phrases.
- If one sentence can replace three — use one.
- Be polite but firm.
- When a decision is made, write "we will" / "I'll do it", not "we could", "we might", or "we will consider".
- If there is a problem — name it clearly and propose a solution immediately.
- Do not avoid saying the other party is wrong, but do it correctly and without emotion.
- If citing a contract — cite the specific clause.
- Do not state what is already obvious to the recipient.
- No artificially elegant or pompous sentences.

Tone: calm, professional, concrete, results-oriented, confident but not arrogant.

Before writing, ask:
- Can this sentence be shorter?
- Is this information actually needed?
- Should "we can" be "we will"?
- Is the next step clear to the recipient?

Do not write like typical ChatGPT.

Avoid these phrases:
- I hope you are doing well.
- Thank you for your patience.
- Please do not hesitate to contact us.
- We greatly appreciate...
- We would be delighted...
- We kindly ask...
- We are pleased to...
- We would like to inform you...
- As you know...
- We are happy to confirm that...

Use natural business language. If the reply fits in 5 sentences, do not write 10. If 2 paragraphs are enough, do not write 5.

The email must read like it was written by someone who makes decisions daily — not AI.`;

const FLUFF_PATTERNS_LT: RegExp[] = [
  /tikiuosi,?\s+kad\s+(viskas gerai|jums sekasi)[^.!?\n]*[.!?]?\s*/gi,
  /dėkojame?\s+už\s+kantrybę[^.!?\n]*[.!?]?\s*/gi,
  /labai\s+dėkojame?\s+už\s+supratingumą[^.!?\n]*[.!?]?\s*/gi,
  /nedvejodami\s+kreipkitės[^.!?\n]*[.!?]?\s*/gi,
  /mes\s+labai\s+vertiname[^.!?\n]*[.!?]?\s*/gi,
  /būtume\s+malonu[^.!?\n]*[.!?]?\s*/gi,
  /maloniai\s+prašome[^.!?\n]*[.!?]?\s*/gi,
  /norime\s+informuoti[^.!?\n]*[.!?]?\s*/gi,
  /informuojame,?\s+kad\s+/gi,
  /kaip\s+(jums\s+)?žinoma,?\s*/gi,
];

const FLUFF_PATTERNS_EN: RegExp[] = [
  /I hope you(?:'re| are) doing well[.!]?\s*/gi,
  /Thank you for your patience[.!]?\s*/gi,
  /Please do not hesitate to contact (?:us|me)[.!]?\s*/gi,
  /We greatly appreciate[^.!?\n]*[.!?]?\s*/gi,
  /We would be delighted[^.!?\n]*[.!?]?\s*/gi,
  /We kindly ask[^.!?\n]*[.!?]?\s*/gi,
  /We are pleased to[^.!?\n]*[.!?]?\s*/gi,
  /We would like to inform you[^.!?\n]*[.!?]?\s*/gi,
  /We are happy to confirm that\s*/gi,
  /As you know,?\s*/gi,
];

export function getWritingVoiceRules(language: ReplyLanguage): string {
  return language === 'en' ? RENATAS_WRITING_PRINCIPLES_EN : RENATAS_WRITING_PRINCIPLES_LT;
}

export function stripCorporateFluff(text: string, language: ReplyLanguage): string {
  const patterns = language === 'en' ? FLUFF_PATTERNS_EN : FLUFF_PATTERNS_LT;
  let result = text;
  for (const pattern of patterns) {
    result = result.replace(pattern, '');
  }
  return result.replace(/\n{3,}/g, '\n\n').trim();
}
