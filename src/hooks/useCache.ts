import { useState, useCallback, useRef, useEffect } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  accessCount: number; // Track how often this data is accessed
}

export function useCache<T>(defaultTtl: number = 15 * 60 * 1000) { // 15 minutes default (increased from 5)
  const [cache, setCache] = useState<Map<string, CacheEntry<T>>>(new Map());
  const cleanupInterval = useRef<NodeJS.Timeout | undefined>(undefined);

  // Cleanup expired entries every 5 minutes
  useEffect(() => {
    cleanupInterval.current = setInterval(() => {
      setCache(prev => {
        const now = Date.now();
        const newCache = new Map();
        
        for (const [key, entry] of prev) {
          if (now - entry.timestamp <= entry.ttl) {
            newCache.set(key, entry);
          }
        }
        
        return newCache;
      });
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      if (cleanupInterval.current) {
        clearInterval(cleanupInterval.current);
      }
    };
  }, []);

  const get = useCallback((key: string): T | null => {
    const entry = cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Entry expired, remove it
      setCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(key);
        return newCache;
      });
      return null;
    }

    // Update access count for LRU-like behavior
    setCache(prev => {
      const newCache = new Map(prev);
      const existingEntry = newCache.get(key);
      if (existingEntry) {
        newCache.set(key, { ...existingEntry, accessCount: existingEntry.accessCount + 1 });
      }
      return newCache;
    });

    return entry.data;
  }, [cache]);

  const set = useCallback((key: string, data: T, ttl?: number) => {
    setCache(prev => {
      const newCache = new Map(prev);
      
      // If cache is getting too large, remove least accessed entries
      if (newCache.size > 100) {
        const entries = Array.from(newCache.entries());
        entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
        const toRemove = entries.slice(0, 20); // Remove 20 least accessed
        toRemove.forEach(([key]) => newCache.delete(key));
      }
      
      newCache.set(key, {
        data,
        timestamp: Date.now(),
        ttl: ttl || defaultTtl,
        accessCount: 1
      });
      return newCache;
    });
  }, [defaultTtl]);

  const clear = useCallback(() => {
    setCache(new Map());
  }, []);

  const remove = useCallback((key: string) => {
    setCache(prev => {
      const newCache = new Map(prev);
      newCache.delete(key);
      return newCache;
    });
  }, []);

  return { get, set, clear, remove };
}
