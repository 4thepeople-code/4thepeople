import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './axios';
import { queryKeys } from './queryKeys';
import type { Department } from '@/types/models';

/**
 * Fetches all active departments for the active tenant.
 */
export async function fetchDepartments(): Promise<Department[]> {
  const response = await apiClient.get('/departments');
  const res = response.data;
  if (Array.isArray(res)) return res as Department[];
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as Record<string, unknown>;
      if (Array.isArray(nested.departments)) return nested.departments as Department[];
    }
    if (Array.isArray(obj.departments)) return obj.departments as Department[];
  }
  return [];
}

/**
 * Fetches a single department by its ID.
 */
export async function fetchDepartmentById(id: string): Promise<Department> {
  const response = await apiClient.get(`/departments/${id}`);
  const res = response.data;
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as Record<string, unknown>;
      if (nested.department) return nested.department as Department;
    }
    if (obj.department) return obj.department as Department;
  }
  return res as Department;
}

/**
 * Query hook to list departments scoped strictly to tenant.
 */
export function useDepartments(slug: string) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).departments.lists(),
    queryFn: fetchDepartments,
    enabled: !!slug,
  });
}

/**
 * Query hook for a specific department by ID.
 */
export function useDepartment(slug: string, id: string) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).departments.detail(id),
    queryFn: () => fetchDepartmentById(id),
    enabled: !!slug && !!id,
  });
}

/**
 * Mutation hook to create a new department.
 */
export function useCreateDepartmentMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Department>) => {
      const response = await apiClient.post('/admin/departments', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).departments.all });
    },
  });
}

/**
 * Mutation hook to update an existing department.
 */
export function useUpdateDepartmentMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Department> }) => {
      const response = await apiClient.patch(`/admin/departments/${id}`, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).departments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).departments.detail(id) });
    },
  });
}

/**
 * Mutation hook to delete a department.
 */
export function useDeleteDepartmentMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/admin/departments/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).departments.all });
    },
  });
}

/**
 * Mutation hook to replace department clubs assignment: PUT /admin/departments/:departmentId/clubs
 */
export function useReplaceDepartmentClubsMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ departmentId, clubIds }: { departmentId: string; clubIds: string[] }) => {
      const response = await apiClient.put(`/admin/departments/${departmentId}/clubs`, { clubIds });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).departments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).clubs.all });
    },
  });
}

/**
 * Mutation hook to replace club departments assignment: PUT /admin/clubs/:clubId/departments
 */
export function useReplaceClubDepartmentsMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clubId, departmentIds }: { clubId: string; departmentIds: string[] }) => {
      const response = await apiClient.put(`/admin/clubs/${clubId}/departments`, { departmentIds });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).departments.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).clubs.all });
    },
  });
}
