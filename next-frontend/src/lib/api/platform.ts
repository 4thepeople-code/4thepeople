import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './axios';
import { queryKeys } from './queryKeys';
import type {
  PlatformAdminUser,
  CreatePlatformAdminPayload,
  UpdatePlatformAdminPayload,
  EnrollTotpPayload,
  EnrollTotpResponse,
} from '@/types/platform';
import type { ApiResponse } from '@/types/api';

/**
 * Hook to fetch the full roster of platform super-administrators.
 * Calls GET /api/platform/admins (routed via BFF to upstream Express).
 */
export function usePlatformAdminsQuery() {
  return useQuery({
    queryKey: queryKeys.platform.admins(),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<{ admins: PlatformAdminUser[] }>>(
        '/platform/admins'
      );
      return response.data.data?.admins || [];
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Mutation hook to provision a new platform super-administrator.
 * Calls POST /api/platform/admins.
 */
export function useCreatePlatformAdminMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePlatformAdminPayload) => {
      const response = await apiClient.post<ApiResponse<{ admin: PlatformAdminUser }>>(
        '/platform/admins',
        payload
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.admins() });
    },
  });
}

/**
 * Mutation hook to update a platform administrator's active state or name.
 * Calls PATCH /api/platform/admins/:id.
 */
export function useUpdatePlatformAdminMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdatePlatformAdminPayload) => {
      const response = await apiClient.patch<ApiResponse<{ admin: PlatformAdminUser }>>(
        `/platform/admins/${id}`,
        payload
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.admins() });
    },
  });
}

/**
 * Mutation hook to reset (clear) a platform administrator's TOTP secret.
 * Calls POST /api/platform/admins/:id/totp/reset.
 */
export function useResetPlatformAdminTotpMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<ApiResponse<{ message: string }>>(
        `/platform/admins/${id}/totp/reset`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.admins() });
    },
  });
}

/**
 * Mutation hook for self-service TOTP enrollment or rotation.
 * Calls POST /api/platform/auth/totp/enroll.
 */
export function useEnrollOwnTotpMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload?: EnrollTotpPayload) => {
      const response = await apiClient.post<ApiResponse<EnrollTotpResponse>>(
        '/platform/auth/totp/enroll',
        payload || {}
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.admins() });
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.session() });
    },
  });
}

