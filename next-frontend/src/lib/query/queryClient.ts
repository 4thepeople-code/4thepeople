import { QueryClient } from '@tanstack/react-query';

/**
 * Creates a QueryClient configured with project-standard defaults:
 * - staleTime: 60 seconds
 * - retry: 1 for ordinary failed queries
 * - refetchOnWindowFocus: false initially
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 60 seconds
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

/**
 * Returns a QueryClient instance:
 * - On the server: always returns a fresh QueryClient to prevent cross-request cache leakage.
 * - In the browser: returns the persistent client singleton.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always create a new client
    return makeQueryClient();
  }
  // Browser: create once and reuse
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

/**
 * Clears and resets all queries in the query cache.
 * Must be invoked on user logout or tenant/identity switch to prevent sensitive data leakage.
 */
export function clearAllQueryCache(): void {
  if (typeof window !== 'undefined' && browserQueryClient) {
    browserQueryClient.clear();
  }
}

