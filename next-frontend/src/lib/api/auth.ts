import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './axios';
import { queryKeys } from './queryKeys';
import type {
  StudentActivationRequestPayload,
  StudentActivationConfirmPayload,
  StudentLoginPayload,
  StandardLoginPayload,
  PlatformLoginPayload,
  PlatformLoginResponse,
  PlatformSetupStatusResponse,
  InitialPlatformSetupPayload,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  AuthUser,
} from '@/types/auth';
import type { ApiResponse } from '@/types/api';

// ============================================================================
// Student Account Activation Mutations
// ============================================================================

/**
 * Mutation hook for student activation code request.
 * Dispatches activation code via Brevo transactional outbox.
 */
export function useStudentActivationRequestMutation() {
  return useMutation({
    mutationFn: async (payload: StudentActivationRequestPayload) => {
      const response = await apiClient.post<ApiResponse<{ message: string }>>(
        '/auth/student/activate/request',
        payload
      );
      return response.data;
    },
  });
}

/**
 * Mutation hook for student activation confirmation and initial password setup.
 */
export function useStudentActivationConfirmMutation(slug?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: StudentActivationConfirmPayload) => {
      const response = await apiClient.post<ApiResponse<{ message: string; user: AuthUser; token?: string }>>(
        '/auth/student/activate/confirm',
        payload
      );
      return response.data;
    },
    onSuccess: () => {
      if (slug) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).auth.all });
      }
    },
  });
}

// ============================================================================
// Role-Specific Authentication Mutations
// ============================================================================

/**
 * Student login mutation: POST /auth/student/login
 */
export function useStudentLoginMutation(slug?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: StudentLoginPayload) => {
      const response = await apiClient.post<ApiResponse<{ message: string; user: AuthUser; token?: string }>>(
        '/auth/student/login',
        credentials
      );
      return response.data;
    },
    onSuccess: () => {
      if (slug) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).auth.all });
      }
    },
  });
}

/**
 * Club / Event Manager login mutation: POST /auth/manager/login
 */
export function useManagerLoginMutation(slug?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: StandardLoginPayload) => {
      const response = await apiClient.post<ApiResponse<{ message: string; user: AuthUser; token?: string }>>(
        '/auth/manager/login',
        credentials
      );
      return response.data;
    },
    onSuccess: () => {
      if (slug) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).auth.all });
      }
    },
  });
}

/**
 * College Administrator login mutation: POST /auth/admin/login
 */
export function useCollegeAdminLoginMutation(slug?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: StandardLoginPayload) => {
      const response = await apiClient.post<ApiResponse<{ message: string; user: AuthUser; token?: string }>>(
        '/auth/admin/login',
        credentials
      );
      return response.data;
    },
    onSuccess: () => {
      if (slug) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).auth.all });
      }
    },
  });
}

/**
 * Platform Super-Administrator login mutation: POST /api/platform/auth/login
 * Supports 2-step verification: Step 1 (email+password), Step 2 (totpCode/setup).
 */
export function usePlatformAdminLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: PlatformLoginPayload) => {
      const response = await apiClient.post<ApiResponse<PlatformLoginResponse>>(
        '/platform/auth/login',
        credentials
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.all });
    },
  });
}

/**
 * Checks whether the platform has been initialized (has at least 1 super-admin): GET /api/platform/auth/setup-status
 */
export function usePlatformSetupStatusQuery() {
  return useQuery({
    queryKey: ['platform', 'setup-status'] as const,
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<PlatformSetupStatusResponse>>(
        '/platform/auth/setup-status'
      );
      return response.data.data;
    },
    staleTime: 10 * 1000,
    retry: 1,
  });
}

/**
 * Provisions the initial root Super-Administrator: POST /api/platform/auth/setup-initial
 */
export function useInitialPlatformSetupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: InitialPlatformSetupPayload) => {
      const response = await apiClient.post<ApiResponse<PlatformLoginResponse>>(
        '/platform/auth/setup-initial',
        payload
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.all });
      queryClient.invalidateQueries({ queryKey: ['platform', 'setup-status'] });
    },
  });
}

// ============================================================================
// Session Inspection Queries
// ============================================================================

/**
 * Fetches current college tenant user profile via HttpOnly cookie: GET /auth/me
 */
export function useMeQuery(slug: string) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).auth.session(),
    queryFn: async (): Promise<AuthUser | null> => {
      const response = await apiClient.get<ApiResponse<{ user: AuthUser }>>('/auth/me');
      return response.data.data?.user || (response.data as unknown as { user: AuthUser }).user || null;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/**
 * Fetches platform administrator profile: GET /api/platform/auth/me
 */
export function usePlatformMeQuery() {
  return useQuery({
    queryKey: queryKeys.platform.session(),
    queryFn: async (): Promise<AuthUser | null> => {
      const response = await apiClient.get<ApiResponse<{ admin: AuthUser }>>('/platform/auth/me');
      return response.data.data?.admin || (response.data as unknown as { admin: AuthUser }).admin || null;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// ============================================================================
// Password Management & Logout Mutations
// ============================================================================

/**
 * Requests manager password reset OTP: POST /auth/manager/forgot-password
 */
export function useManagerForgotPasswordMutation() {
  return useMutation({
    mutationFn: async (payload: ForgotPasswordPayload) => {
      const response = await apiClient.post<ApiResponse<{ message: string }>>(
        '/auth/manager/forgot-password',
        payload
      );
      return response.data;
    },
  });
}

/**
 * Resets manager password with verified OTP: POST /auth/manager/reset-password
 */
export function useManagerResetPasswordMutation() {
  return useMutation({
    mutationFn: async (payload: ResetPasswordPayload) => {
      const response = await apiClient.post<ApiResponse<{ message: string }>>(
        '/auth/manager/reset-password',
        payload
      );
      return response.data;
    },
  });
}

/**
 * College user logout: POST /auth/logout
 */
export function useLogoutMutation(slug?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiResponse<{ message: string }>>('/auth/logout');
      return response.data;
    },
    onSuccess: () => {
      if (slug) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).all });
      }
    },
  });
}

/**
 * Platform administrator logout: POST /api/platform/auth/logout
 */
export function usePlatformLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiResponse<{ message: string }>>('/platform/auth/logout');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.all });
    },
  });
}
