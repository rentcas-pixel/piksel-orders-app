import { useState, useEffect, useCallback, useRef } from 'react';

export const SEARCH_DEBOUNCE_MS = 600;
export const SEARCH_MIN_LENGTH = 2;

/** Debounce value – atnaujina tik po delay ms nuo paskutinio pakeitimo */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Paieškos lauko debounce: laukia SEARCH_DEBOUNCE_MS ir taiko filtrą tik nuo SEARCH_MIN_LENGTH simbolių.
 * Viena raidė neiškviečia užklausos; išvalius lauką filtras iškart nuimamas.
 */
export function useDebouncedSearchQuery(
  rawQuery: string,
  options?: { delay?: number; minLength?: number }
): string {
  const delay = options?.delay ?? SEARCH_DEBOUNCE_MS;
  const minLength = options?.minLength ?? SEARCH_MIN_LENGTH;
  const debouncedRaw = useDebounce(rawQuery.trim(), delay);
  const [effectiveQuery, setEffectiveQuery] = useState('');

  useEffect(() => {
    if (debouncedRaw.length === 0 || debouncedRaw.length >= minLength) {
      setEffectiveQuery(debouncedRaw);
    }
  }, [debouncedRaw, minLength]);

  return effectiveQuery;
}

/** Debounced callback – kviečiama tik po delay ms nuo paskutinio iškvietimo */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);

  fnRef.current = fn;

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        fnRef.current(...args);
        timeoutRef.current = null;
      }, delay);
    }) as T,
    [delay]
  );
}
