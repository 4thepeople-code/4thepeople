import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './axios';
import { queryKeys } from './queryKeys';
import type { Club, Event, User } from '@/types/models';

// ============================================================================
// Types
// ============================================================================

export interface CreateEventInput {
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt?: string | null;
  registrationUrl?: string | null;
  registrationMode?: 'INTERNAL' | 'EXTERNAL' | 'NONE';
  capacity?: number | null;
  customFormDefinition?: { fields: unknown[] } | null;
  registrationDeadline?: string | null;
}

export type UpdateEventInput = Partial<CreateEventInput>;

export interface EventAttendeeItem {
  id: string;
  eventId: string;
  registeredAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
  formAnswers?: Record<string, unknown> | null;
}

export interface EventAttendeesResponse {
  club?: { id: string; name: string };
  event?: { id: string; title: string; capacity?: number | null; registeredCount?: number };
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  registrations: EventAttendeeItem[];
}

export interface ManagerProfileData extends Partial<User> {
  managedClubs?: Array<{ id: string; name: string }>;
}

// ============================================================================
// Managed Clubs API & Queries
// ============================================================================

/**
 * Fetches all clubs managed by the authenticated user in the current tenant.
 * Backend: GET /manager/my-clubs
 */
export async function fetchMyClubs(): Promise<Club[]> {
  const response = await apiClient.get('/manager/my-clubs');
  const res = response.data;
  if (Array.isArray(res)) return res as Club[];
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (Array.isArray(obj.clubs)) return obj.clubs as Club[];
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as Record<string, unknown>;
      if (Array.isArray(nested.clubs)) return nested.clubs as Club[];
    }
  }
  return [];
}

export function useMyClubsQuery(slug: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).manager.myClubs(),
    queryFn: () => fetchMyClubs(),
    enabled: !!slug && enabled,
  });
}

/**
 * Fetches single club manager dashboard data (including members and permissions).
 * Backend: GET /club/:clubId/dashboard
 */
export async function fetchClubDashboard(clubId: string): Promise<Club> {
  const response = await apiClient.get(`/club/${clubId}/dashboard`);
  const res = response.data;
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as Record<string, unknown>;
      if (nested.club) return nested.club as Club;
      return obj.data as Club;
    }
    if (obj.club) return obj.club as Club;
  }
  return res as Club;
}

export function useClubDashboardQuery(slug: string, clubId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).manager.clubDashboard(clubId),
    queryFn: () => fetchClubDashboard(clubId),
    enabled: !!slug && !!clubId && enabled,
  });
}

/**
 * Updates manager-editable fields on an assigned club.
 * Backend: PATCH /manager/clubs/:clubId
 */
export async function updateManagedClub(
  clubId: string,
  data: { name?: string; description?: string | null }
): Promise<Club> {
  const response = await apiClient.patch(`/manager/clubs/${clubId}`, data);
  const res = response.data;
  return (res?.data || res?.club || res) as Club;
}

export function useUpdateManagedClubMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clubId, data }: { clubId: string; data: { name?: string; description?: string | null } }) =>
      updateManagedClub(clubId, data),
    onSuccess: (_, { clubId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).manager.myClubs() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).manager.clubDashboard(clubId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).clubs.detail(clubId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).clubs.all });
    },
  });
}

// ============================================================================
// Club Media & Branding
// ============================================================================

export async function uploadClubLogo(clubId: string, formData: FormData) {
  const response = await apiClient.post(`/admin/clubs/${clubId}/logo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function deleteClubLogo(clubId: string) {
  const response = await apiClient.delete(`/admin/clubs/${clubId}/logo`);
  return response.data;
}

export async function uploadClubCover(clubId: string, formData: FormData) {
  const response = await apiClient.post(`/admin/clubs/${clubId}/cover`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function deleteClubCover(clubId: string) {
  const response = await apiClient.delete(`/admin/clubs/${clubId}/cover`);
  return response.data;
}

// ============================================================================
// Managed Club Events API & Mutations
// ============================================================================

/**
 * Lists all events (upcoming, ongoing, past, cancelled) for an assigned club.
 * Backend: GET /manager/clubs/:clubId/events
 */
export async function fetchManagedClubEvents(clubId: string): Promise<Event[]> {
  const response = await apiClient.get(`/manager/clubs/${clubId}/events`);
  const res = response.data;
  if (Array.isArray(res)) return res as Event[];
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (Array.isArray(obj.events)) return obj.events as Event[];
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as Record<string, unknown>;
      if (Array.isArray(nested.events)) return nested.events as Event[];
    }
  }
  return [];
}

export function useManagedClubEventsQuery(slug: string, clubId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).manager.clubEvents(clubId),
    queryFn: () => fetchManagedClubEvents(clubId),
    enabled: !!slug && !!clubId && enabled,
  });
}

/**
 * Creates a new event for an assigned club.
 * Backend: POST /manager/clubs/:clubId/events
 */
export async function createClubEvent(clubId: string, data: CreateEventInput): Promise<Event> {
  const response = await apiClient.post(`/manager/clubs/${clubId}/events`, data);
  const res = response.data;
  return (res?.event || res?.data || res) as Event;
}

export function useCreateClubEventMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clubId, data }: { clubId: string; data: CreateEventInput }) =>
      createClubEvent(clubId, data),
    onSuccess: (_, { clubId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).manager.clubEvents(clubId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).events.all });
    },
  });
}

/**
 * Updates an event for an assigned club.
 * Backend: PATCH /manager/clubs/:clubId/events/:eventId
 */
export async function updateClubEvent(
  clubId: string,
  eventId: string,
  data: UpdateEventInput
): Promise<Event> {
  const response = await apiClient.patch(`/manager/clubs/${clubId}/events/${eventId}`, data);
  const res = response.data;
  return (res?.event || res?.data || res) as Event;
}

export function useUpdateClubEventMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      clubId,
      eventId,
      data,
    }: {
      clubId: string;
      eventId: string;
      data: UpdateEventInput;
    }) => updateClubEvent(clubId, eventId, data),
    onSuccess: (_, { clubId, eventId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).manager.clubEvents(clubId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).events.detail(clubId, eventId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).events.all });
    },
  });
}

/**
 * Cancels an event for an assigned club.
 * Backend: PATCH /manager/clubs/:clubId/events/:eventId/cancel
 */
export async function cancelClubEvent(clubId: string, eventId: string): Promise<Event> {
  const response = await apiClient.patch(`/manager/clubs/${clubId}/events/${eventId}/cancel`);
  const res = response.data;
  return (res?.event || res?.data || res) as Event;
}

export function useCancelClubEventMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clubId, eventId }: { clubId: string; eventId: string }) =>
      cancelClubEvent(clubId, eventId),
    onSuccess: (_, { clubId, eventId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).manager.clubEvents(clubId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).events.detail(clubId, eventId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).events.all });
    },
  });
}

/**
 * Deletes an event permanently.
 * Backend: DELETE /admin/events/:eventId
 */
export async function deleteClubEvent(eventId: string) {
  const response = await apiClient.delete(`/admin/events/${eventId}`);
  return response.data;
}

export function useDeleteClubEventMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId }: { eventId: string; clubId?: string }) =>
      deleteClubEvent(eventId),
    onSuccess: (_, { clubId, eventId }) => {
      if (clubId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).manager.clubEvents(clubId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).events.all });
      queryClient.removeQueries({ queryKey: queryKeys.tenant(slug).events.detail(clubId || '', eventId) });
    },
  });
}

// ============================================================================
// Event Media (Cover & Gallery)
// ============================================================================

export async function uploadEventCover(eventId: string, formData: FormData) {
  const response = await apiClient.post(`/admin/events/${eventId}/cover`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function deleteEventCover(eventId: string) {
  const response = await apiClient.delete(`/admin/events/${eventId}/cover`);
  return response.data;
}

export async function uploadEventGallery(eventId: string, formData: FormData) {
  const response = await apiClient.post(`/admin/events/${eventId}/gallery`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function deleteEventGalleryImage(eventId: string, publicId: string) {
  const response = await apiClient.delete(
    `/admin/events/${eventId}/gallery/${encodeURIComponent(publicId)}`
  );
  return response.data;
}

// ============================================================================
// Event Attendees API
// ============================================================================

/**
 * Fetches attendee registrations for an event.
 * Backend: GET /manager/clubs/:clubId/events/:eventId/registrations?page=1&limit=20
 */
export async function fetchEventAttendees(
  clubId: string,
  eventId: string,
  page = 1,
  limit = 20
): Promise<EventAttendeesResponse> {
  const response = await apiClient.get(
    `/manager/clubs/${clubId}/events/${eventId}/registrations?page=${page}&limit=${limit}`
  );
  const res = response.data;
  return (res?.data || res) as EventAttendeesResponse;
}

export function useEventAttendeesQuery(
  slug: string,
  clubId: string,
  eventId: string,
  page = 1,
  limit = 20,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).manager.attendees(clubId, eventId, page),
    queryFn: () => fetchEventAttendees(clubId, eventId, page, limit),
    enabled: !!slug && !!clubId && !!eventId && enabled,
  });
}

// ============================================================================
// Manager Profile API & Queries
// ============================================================================

/**
 * Fetches profile details for the authenticated manager.
 * Backend: GET /manager/profile
 */
export async function fetchManagerProfile(): Promise<ManagerProfileData> {
  const response = await apiClient.get('/manager/profile');
  const res = response.data;
  return (res?.data || res) as ManagerProfileData;
}

export function useManagerProfileQuery(slug: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).manager.profile(),
    queryFn: () => fetchManagerProfile(),
    enabled: !!slug && enabled,
  });
}

/**
 * Updates manager name and/or password.
 * Backend: PATCH /manager/profile
 */
export async function updateManagerProfile(data: {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}) {
  const response = await apiClient.patch('/manager/profile', data);
  return response.data;
}

export function useUpdateManagerProfileMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; currentPassword?: string; newPassword?: string }) =>
      updateManagerProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).manager.profile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).auth.all });
    },
  });
}

export async function uploadManagerAvatar(formData: FormData) {
  const response = await apiClient.post('/manager/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function deleteManagerAvatar() {
  const response = await apiClient.delete('/manager/profile/avatar');
  return response.data;
}
