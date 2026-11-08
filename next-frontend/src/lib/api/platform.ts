import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './axios';
import { queryKeys } from './queryKeys';
import type {
  PlatformAdminUser,
  CreatePlatformAdminPayload,
  UpdatePlatformAdminPayload,
  EnrollTotpPayload,
  EnrollTotpResponse,
  PlatformCollege,
  CreateCollegePayload,
  UpdateCollegePayload,
  ToggleCollegeStatusPayload,
  ProvisionCollegeAdminPayload,
  ResendCollegeAdminInvitePayload,
  ToggleCollegeAdminStatusPayload,
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

/**
 * Hook to fetch registered colleges with their assigned administrators.
 * Calls GET /api/platform/colleges.
 */
export function usePlatformCollegesQuery(params?: { search?: string; status?: string; adminStatus?: string }) {
  return useQuery({
    queryKey: [...queryKeys.platform.colleges(), params || {}],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.set('search', params.search);
      if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
      if (params?.adminStatus && params.adminStatus !== 'all') searchParams.set('adminStatus', params.adminStatus);

      const qs = searchParams.toString();
      const url = qs ? `/platform/colleges?${qs}` : '/platform/colleges';

      const response = await apiClient.get<ApiResponse<PlatformCollege[]>>(url);
      return response.data.data || [];
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Hook to fetch single college details with assigned admins.
 * Calls GET /api/platform/colleges/:id.
 */
export function usePlatformCollegeDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.platform.collegeDetail(id),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<PlatformCollege>>(`/platform/colleges/${id}`);
      return response.data.data;
    },
    enabled: Boolean(id),
  });
}

/**
 * Mutation hook to create a new college (optionally with an administrator).
 * Calls POST /api/platform/colleges.
 */
export function useCreateCollegeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCollegePayload) => {
      const response = await apiClient.post<ApiResponse<{ college: PlatformCollege }>>(
        '/platform/colleges',
        payload
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.colleges() });
    },
  });
}

/**
 * Mutation hook to update college details.
 * Calls PUT /api/platform/colleges/:id.
 */
export function useUpdateCollegeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCollegePayload) => {
      const response = await apiClient.put<ApiResponse<PlatformCollege>>(
        `/platform/colleges/${id}`,
        payload
      );
      return response.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.colleges() });
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.collegeDetail(vars.id) });
    },
  });
}

/**
 * Mutation hook to toggle college active status.
 * Calls PATCH /api/platform/colleges/:id/status.
 */
export function useToggleCollegeStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: ToggleCollegeStatusPayload) => {
      const response = await apiClient.patch<ApiResponse<{ id: string; isActive: boolean }>>(
        `/platform/colleges/${id}/status`,
        { isActive }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.colleges() });
    },
  });
}

/**
 * Mutation hook to provision an administrator for an existing unassigned college.
 * Calls POST /api/platform/colleges/:id/admins.
 */
export function useProvisionCollegeAdminMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ collegeId, name, email }: ProvisionCollegeAdminPayload) => {
      const response = await apiClient.post<ApiResponse<{ admin: unknown }>>(
        `/platform/colleges/${collegeId}/admins`,
        { name, email }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.colleges() });
    },
  });
}

/**
 * Mutation hook to resend invitation email to an administrator.
 * Calls POST /api/platform/college-admins/:id/resend-invitation.
 */
export function useResendCollegeAdminInviteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ adminId }: ResendCollegeAdminInvitePayload) => {
      const response = await apiClient.post<ApiResponse<{ admin: unknown }>>(
        `/platform/college-admins/${adminId}/resend-invitation`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.colleges() });
    },
  });
}

/**
 * Mutation hook to suspend or reactivate a College Administrator account.
 * Calls PATCH /api/platform/college-admins/:id/status.
 */
export function useToggleCollegeAdminStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ adminId, isActive }: ToggleCollegeAdminStatusPayload) => {
      const response = await apiClient.patch<ApiResponse<{ id: string; isActive: boolean; status: string }>>(
        `/platform/college-admins/${adminId}/status`,
        { isActive }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.colleges() });
    },
  });
}


