import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './axios';
import { queryKeys } from './queryKeys';
import type { Club } from '@/types/models';

/**
 * Fetches all public clubs for the active tenant.
 */
export async function fetchClubs(collegeId?: string): Promise<Club[]> {
  const url = collegeId ? `/clubs?collegeId=${encodeURIComponent(collegeId)}` : '/clubs';
  const response = await apiClient.get(url);
  const res = response.data;
  if (Array.isArray(res)) return res as Club[];
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as Record<string, unknown>;
      if (Array.isArray(nested.clubs)) return nested.clubs as Club[];
    }
    if (Array.isArray(obj.clubs)) return obj.clubs as Club[];
  }
  return [];
}

/**
 * Fetches single club details by ID.
 */
export async function fetchClubById(clubId: string): Promise<Club> {
  const response = await apiClient.get(`/clubs/${clubId}`);
  const res = response.data;
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as Record<string, unknown>;
      if (nested.club) return nested.club as Club;
    }
    if (obj.club) return obj.club as Club;
  }
  return res as Club;
}

/**
 * Query hook to list clubs scoped strictly to tenant.
 */
export function useClubs(slug: string, collegeId?: string) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).clubs.lists(),
    queryFn: () => fetchClubs(collegeId),
    enabled: !!slug,
  });
}

/**
 * Query hook for a specific club.
 */
export function useClub(slug: string, clubId: string) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).clubs.detail(clubId),
    queryFn: () => fetchClubById(clubId),
    enabled: !!slug && !!clubId,
  });
}

/**
 * Mutation hook to create a new club.
 * Express Route: POST /admin/create-club (adminRoutes.js:74)
 */
export function useCreateClubMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Club> & { departmentIds?: string[] }) => {
      const response = await apiClient.post('/admin/create-club', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).clubs.all });
    },
  });
}

/**
 * Mutation hook to update an existing club.
 * Express Route: PATCH /admin/clubs/:clubId (adminRoutes.js:77)
 */
export function useUpdateClubMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Club> }) => {
      const response = await apiClient.patch(`/admin/clubs/${id}`, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).clubs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).clubs.detail(id) });
    },
  });
}
