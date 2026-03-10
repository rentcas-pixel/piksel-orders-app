import { useState, useEffect, useCallback, useRef } from 'react';

/** Debounce value – atnaujina tik po delay ms nuo paskutinio pakeitimo */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
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
