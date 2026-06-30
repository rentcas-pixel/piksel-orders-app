import type { BankTransaction } from '@/types';
import {
  companyNameMatches,
  coreCompanyName,
  foldSearchText,
  normalizeCompanyName,
} from '@/lib/company-name-match';
import { resolveBankCounterparty } from '@/lib/bank-counterparty';
import { isGarbledSkleriaiText, normalizeKnownCompanyText } from '@/lib/bank-csv-encoding';

/** Žinomi trumpiniai paieškai (pvz. „šklėr“ → Šklėriai). */
const SEARCH_ALIASES: { canonical: string; patterns: RegExp[] }[] = [
  {
    canonical: 'UAB Šklėriai',
    patterns: [/šklėr/i, /skler/i, /šklėriai/i, /skleriai/i, /ÐKL/i, /KLËRIAI/i],
  },
];

function expandSearchQuery(query: string): string[] {
  const terms = new Set<string>([query.trim(), foldSearchText(query), normalizeCompanyName(query)]);
  const qCore = coreCompanyName(query);

  for (const alias of SEARCH_ALIASES) {
    const aliasCore = normalizeCompanyName(alias.canonical);
    const aliasMatches =
      alias.patterns.some((pattern) => pattern.test(query)) ||
      (qCore.length >= 4 && aliasCore.includes(qCore)) ||
      (qCore.length >= 4 && qCore.includes(aliasCore.slice(0, Math.min(6, aliasCore.length))));

    if (aliasMatches) {
      terms.add(alias.canonical);
      terms.add(foldSearchText(alias.canonical));
      terms.add(normalizeCompanyName(alias.canonical));
      terms.add(coreCompanyName(alias.canonical));
    }
  }

  return [...terms].filter(Boolean);
}

export function matchesBankSearch(
  tx: Pick<BankTransaction, 'counterparty' | 'description' | 'transaction_date' | 'amount'>,
  query: string
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const resolved = resolveBankCounterparty(tx.counterparty, tx.description);
  const rawText = normalizeKnownCompanyText(
    `${resolved} ${tx.counterparty ?? ''} ${tx.description ?? ''} ${tx.transaction_date} ${tx.amount}`
  );
  const folded = foldSearchText(rawText);
  const rawCore = coreCompanyName(rawText);

  for (const term of expandSearchQuery(trimmed)) {
    const termFolded = foldSearchText(term);
    if (termFolded && folded.includes(termFolded)) return true;

    const termCore = coreCompanyName(term);
    if (termCore.length >= 3 && rawCore.includes(termCore)) return true;

    if (companyNameMatches(rawText, term) || companyNameMatches(term, resolved)) {
      return true;
    }
    if (isGarbledSkleriaiText(rawText) && /šklėr|skler|ÐKL|KLËRIAI/i.test(term)) {
      return true;
    }
  }

  return false;
}
