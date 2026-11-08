import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getStoredToken, clearStoredAuth } from '../auth/tokenStorage';
import type { ApiError } from '@/types/api';

/**
 * Derives the base URL for API requests:
 * - In the browser: uses same-origin relative path '/api', routing requests through the Next.js BFF proxy.
 * - On the server: routes directly to the internal Express backend address.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return '/api';
  }
  return (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.BACKEND_URL ||
    'http://localhost:5000'
  );
}

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true, // Send HttpOnly cookies across same-origin and proxy boundaries
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach bearer token if stored in localStorage (fallback/hybrid)
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Dynamically ensure correct baseURL in browser
    if (typeof window !== 'undefined' && (!config.baseURL || config.baseURL !== '/api')) {
      config.baseURL = '/api';
    }

    const token = getStoredToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401s and format errors cleanly
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; errors?: Record<string, string[]> | string; code?: string }>) => {
    if (error.response?.status === 401) {
      // Clear client-side storage on unauthorized response
      clearStoredAuth();
    }

    const normalizedError: ApiError = {
      status: error.response?.status || 500,
      message: error.response?.data?.message || error.message || 'An unexpected error occurred',
      code: error.response?.data?.code,
      errors: error.response?.data?.errors,
    };

    return Promise.reject(normalizedError);
  }
);

export default apiClient;
