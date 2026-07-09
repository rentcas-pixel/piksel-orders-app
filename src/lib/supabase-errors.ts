import type { PostgrestError } from '@supabase/supabase-js';

let specPricesTableMissingLogged = false;

export function formatSupabaseError(error: PostgrestError): string {
  return [error.code, error.message, error.details, error.hint].filter(Boolean).join(' — ');
}

export function isMissingRelationError(error: PostgrestError | null, relation: string): boolean {
  if (!error) return false;
  const blob = `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  const rel = relation.toLowerCase();
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    blob.includes('schema cache') ||
    (blob.includes(rel) && (blob.includes('does not exist') || blob.includes('could not find')))
  );
}

export function warnSpecPricesTableMissingOnce(): void {
  if (specPricesTableMissingLogged) return;
  specPricesTableMissingLogged = true;
  console.warn(
    '[Spec orders] Supabase lentelė order_spec_prices nerasta. ' +
      'Paleiskite SQL: supabase/migrations/20260709_order_spec_prices.sql (Dashboard → SQL Editor).'
  );
}
