import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './axios';
import { queryKeys } from './queryKeys';
import type { User, Club } from '@/types/models';
import type { ApiResponse } from '@/types/api';

// ============================================================================
// Types
// ============================================================================

export interface AdminProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  collegeId?: string;
  avatar?: { url?: string | null; publicId?: string | null } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClubManagerItem {
  id: string;
  role: string;
  joinedAt?: string;
  createdAt?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: { url?: string | null } | null;
  };
  userId?: string;
}

export interface RosterSummary {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
}

export interface RosterStudentRow {
  rollNumber: string;
  name: string;
  department?: string | null;
  admissionYear?: number | null;
  email?: string | null;
}

// ============================================================================
// Admin Profile Hooks
// ============================================================================

export function useAdminProfileQuery(slug: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).admin.profile(),
    queryFn: async (): Promise<AdminProfile> => {
      const response = await apiClient.get<ApiResponse<AdminProfile>>('/admin/profile');
      const data = response.data?.data || (response.data as unknown as AdminProfile);
      return data;
    },
    enabled: !!slug && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateAdminProfileMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name?: string; currentPassword?: string; newPassword?: string }) => {
      const response = await apiClient.patch<ApiResponse<AdminProfile>>('/admin/profile', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.profile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).auth.all });
    },
  });
}

export function useUploadAdminAvatarMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiClient.post<ApiResponse<AdminProfile>>('/admin/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.profile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).auth.all });
    },
  });
}

export function useDeleteAdminAvatarMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.delete<ApiResponse<AdminProfile>>('/admin/profile/avatar');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.profile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).auth.all });
    },
  });
}

// ============================================================================
// User Management Hooks
// ============================================================================

export function useAllUsersQuery(slug: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).admin.users(),
    queryFn: async (): Promise<User[]> => {
      const response = await apiClient.get<ApiResponse<User[]>>('/admin/viewAllUsers');
      const res = response.data;
      if (Array.isArray(res)) return res;
      if (res && typeof res === 'object') {
        const obj = res as unknown as Record<string, unknown>;
        if (Array.isArray(obj.data)) return obj.data as User[];
        if (Array.isArray(obj.users)) return obj.users as User[];
      }
      return [];
    },
    enabled: !!slug && enabled,
    staleTime: 60 * 1000,
  });
}

export function useUserDetailQuery(slug: string, userId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).admin.userDetail(userId),
    queryFn: async (): Promise<User> => {
      const response = await apiClient.get<ApiResponse<User>>(`/admin/viewUser/${userId}`);
      const res = response.data;
      if (res?.data) return res.data as User;
      return res as unknown as User;
    },
    enabled: !!slug && !!userId && enabled,
  });
}

export function useRequestUserDeletionCodeMutation() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiClient.post<ApiResponse<{ message: string }>>(
        `/admin/users/${userId}/delete/request-code`
      );
      return response.data;
    },
  });
}

export function useDeleteUserMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, code }: { userId: string; code: string }) => {
      const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/admin/deleteUser/${userId}`, {
        data: { code },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.users() });
    },
  });
}

// ============================================================================
// Club Management Hooks
// ============================================================================

export function useAdminClubsQuery(slug: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).admin.clubs(),
    queryFn: async (): Promise<Club[]> => {
      const response = await apiClient.get<ApiResponse<Club[]>>('/admin/clubs');
      const res = response.data;
      if (Array.isArray(res)) return res;
      if (res && typeof res === 'object') {
        const obj = res as unknown as Record<string, unknown>;
        if (Array.isArray(obj.data)) return obj.data as Club[];
        if (Array.isArray(obj.clubs)) return obj.clubs as Club[];
      }
      return [];
    },
    enabled: !!slug && enabled,
    staleTime: 60 * 1000,
  });
}

export function useAdminClubDetailQuery(slug: string, clubId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).admin.clubDetail(clubId),
    queryFn: async (): Promise<Club> => {
      const response = await apiClient.get<ApiResponse<Club>>(`/admin/clubs/${clubId}`);
      const res = response.data;
      if (res?.data) return res.data as Club;
      return res as unknown as Club;
    },
    enabled: !!slug && !!clubId && enabled,
  });
}

export function useClubManagersQuery(slug: string, clubId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).admin.clubManagers(clubId),
    queryFn: async (): Promise<ClubManagerItem[]> => {
      const response = await apiClient.get<ApiResponse<{ managers: ClubManagerItem[] }>>(
        `/admin/clubs/${clubId}/managers`
      );
      const res = response.data;
      if (res?.data?.managers) return res.data.managers;
      if ((res as unknown as { managers: ClubManagerItem[] })?.managers) {
        return (res as unknown as { managers: ClubManagerItem[] }).managers;
      }
      return [];
    },
    enabled: !!slug && !!clubId && enabled,
  });
}

export function useCreateAdminClubMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string | null; isCentral?: boolean }) => {
      const response = await apiClient.post<ApiResponse<{ id: string; club: Club }>>('/admin/create-club', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.clubs() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).clubs.all });
    },
  });
}

export function useUpdateAdminClubMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clubId, data }: { clubId: string; data: Partial<Club> }) => {
      const response = await apiClient.patch<ApiResponse<{ club: Club }>>(`/admin/clubs/${clubId}`, data);
      return response.data;
    },
    onSuccess: (_, { clubId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.clubs() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.clubDetail(clubId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).clubs.all });
    },
  });
}

export function useUploadClubLogoMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clubId, formData }: { clubId: string; formData: FormData }) => {
      const response = await apiClient.post<ApiResponse<Club>>(`/admin/clubs/${clubId}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    onSuccess: (_, { clubId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.clubs() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.clubDetail(clubId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).clubs.all });
    },
  });
}

export function useDeleteClubLogoMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clubId: string) => {
      const response = await apiClient.delete<ApiResponse<Club>>(`/admin/clubs/${clubId}/logo`);
      return response.data;
    },
    onSuccess: (_, clubId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.clubs() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.clubDetail(clubId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).clubs.all });
    },
  });
}

export function useRequestClubDeletionCodeMutation() {
  return useMutation({
    mutationFn: async (clubId: string) => {
      const response = await apiClient.post<ApiResponse<{ message: string }>>(
        `/admin/clubs/${clubId}/delete/request-code`
      );
      return response.data;
    },
  });
}

export function useDeleteClubMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clubId, code }: { clubId: string; code: string }) => {
      const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/admin/clubs/${clubId}`, {
        data: { code },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.clubs() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).clubs.all });
    },
  });
}

// ============================================================================
// Manager Invitation & Membership Hooks
// ============================================================================

export function useCreateManagerMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; email: string; clubId?: string }) => {
      const response = await apiClient.post<ApiResponse<{ user: User }>>('/admin/managers', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.users() });
    },
  });
}

export function useInviteManagerToClubMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clubId, data }: { clubId: string; data: { name: string; email: string } }) => {
      const response = await apiClient.post<ApiResponse<{ user: User }>>(`/admin/clubs/${clubId}/managers`, data);
      return response.data;
    },
    onSuccess: (_, { clubId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.clubManagers(clubId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.users() });
    },
  });
}

export function useAddExistingManagerToClubMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clubId, userId }: { clubId: string; userId: string }) => {
      const response = await apiClient.post<ApiResponse<{ membership: unknown }>>(
        `/admin/clubs/${clubId}/managers/existing`,
        { userId }
      );
      return response.data;
    },
    onSuccess: (_, { clubId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.clubManagers(clubId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.users() });
    },
  });
}

export function useResendInviteMutation() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiClient.post<ApiResponse<{ message: string }>>(
        `/admin/managers/${userId}/resend-invite`
      );
      return response.data;
    },
  });
}

export function useDeleteMembershipMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (membershipId: string) => {
      const response = await apiClient.delete<ApiResponse<{ message: string }>>(
        `/admin/memberships/${membershipId}`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.clubs() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.all });
    },
  });
}

// ============================================================================
// Student Roster Upload Hook
// ============================================================================

export function useUploadStudentRosterMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { csv?: string; students?: RosterStudentRow[] } | string) => {
      let response;
      if (typeof payload === 'string') {
        response = await apiClient.post<ApiResponse<{ summary: RosterSummary }>>(
          '/admin/students/roster',
          payload,
          { headers: { 'Content-Type': 'text/csv' } }
        );
      } else {
        response = await apiClient.post<ApiResponse<{ summary: RosterSummary }>>(
          '/admin/students/roster',
          payload
        );
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.users() });
    },
  });
}

// ============================================================================
// Manager Invitation Verification & Acceptance Hooks
// ============================================================================

export function useValidateInviteQuery(slug: string, token: string, enabled = true) {
  return useQuery({
    queryKey: ['tenant', slug, 'invite', 'validate', token] as const,
    queryFn: async (): Promise<{ valid: boolean; user?: { id: string; name: string; email: string } }> => {
      const response = await apiClient.get<ApiResponse<{ valid: boolean; user?: { id: string; name: string; email: string } }>>(
        `/invite/${token}/validate`
      );
      const res = response.data;
      if (res?.data) return res.data;
      return (res as unknown as { valid: boolean; user?: { id: string; name: string; email: string } }) || { valid: false };
    },
    enabled: !!slug && !!token && enabled,
    retry: false,
  });
}

export function useAcceptInviteMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      const response = await apiClient.post<ApiResponse<{ user: User; message: string }>>(
        `/invite/${token}/accept`,
        { password }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).admin.users() });
    },
  });
}
