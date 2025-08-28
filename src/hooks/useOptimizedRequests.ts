import { useRef, useCallback } from 'react';

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

export function useOptimizedRequests() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingRequests = useRef<Map<string, PendingRequest<any>>>(new Map());
  const connectionPool = useRef<Set<string>>(new Set());
  const maxConnections = 5; // Limit concurrent connections

  // Deduplicate requests - if same request is already pending, return existing promise
  const deduplicateRequest = useCallback(<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> => {
    const existing = pendingRequests.current.get(key);
    if (existing) {
      // If request is older than 30 seconds, consider it stale
      if (Date.now() - existing.timestamp < 30000) {
        return existing.promise;
      }
      // Remove stale request
      pendingRequests.current.delete(key);
    }

    // Create new request
    const promise = requestFn().finally(() => {
      pendingRequests.current.delete(key);
    });

    pendingRequests.current.set(key, {
      promise,
      timestamp: Date.now()
    });

    return promise;
  }, []);

  // Connection pooling - limit concurrent requests
  const withConnectionLimit = useCallback(async <T>(
    requestFn: () => Promise<T>
  ): Promise<T> => {
    if (connectionPool.current.size >= maxConnections) {
      // Wait for a connection to become available
      await new Promise(resolve => {
        const checkConnection = () => {
          if (connectionPool.current.size < maxConnections) {
            resolve(undefined);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    }

    const connectionId = Math.random().toString(36);
    connectionPool.current.add(connectionId);

    try {
      return await requestFn();
    } finally {
      connectionPool.current.delete(connectionId);
    }
  }, []);

  // Batch multiple requests into one
  const batchRequests = useCallback(async <T>(
    requests: Array<() => Promise<T>>,
    batchSize: number = 3
  ): Promise<T[]> => {
    const results: T[] = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(request => withConnectionLimit(request))
      );
      results.push(...batchResults);
      
      // Small delay between batches to prevent overwhelming the server
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }, [withConnectionLimit]);

  // Clear all pending requests
  const clearPendingRequests = useCallback(() => {
    pendingRequests.current.clear();
  }, []);

  // Get current connection count
  const getConnectionCount = useCallback(() => {
    return connectionPool.current.size;
  }, []);

  return {
    deduplicateRequest,
    withConnectionLimit,
    batchRequests,
    clearPendingRequests,
    getConnectionCount
  };
}
