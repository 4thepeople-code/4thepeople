import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './axios';
import { queryKeys } from './queryKeys';
import type {
  Club,
  Event,
  User,
  EventCertificate,
  CertificateBatch,
  EventCertificateTemplate,
  EligibleStudentItem,
  PlaceholderConfigItem,
} from '@/types/models';

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
  try {
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
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 403 || status === 401) {
      return [];
    }
    throw err;
  }
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

// ============================================================================
// Event Certificates API & Hooks
// ============================================================================

export interface EventCertificatesResponse {
  certificates: EventCertificate[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function fetchEventCertificates(
  slug: string,
  eventId: string,
  page = 1,
  status = 'ALL',
  search = ''
): Promise<EventCertificatesResponse> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (status && status !== 'ALL') params.set('status', status);
  if (search) params.set('search', search);

  const response = await apiClient.get(`/manager/events/${eventId}/certificates?${params.toString()}`);
  const data = response.data?.data || response.data;
  return {
    certificates: data.certificates || [],
    pagination: data.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 },
  };
}

export function useEventCertificatesQuery(
  slug: string,
  eventId: string,
  page = 1,
  status = 'ALL',
  search = '',
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).certificates.eventCertificates(eventId, page, status, search),
    queryFn: () => fetchEventCertificates(slug, eventId, page, status, search),
    enabled: !!slug && !!eventId && enabled,
  });
}

export async function fetchEligibleStudents(slug: string, eventId: string): Promise<EligibleStudentItem[]> {
  const response = await apiClient.get(`/manager/events/${eventId}/certificates/eligible-students`);
  const data = response.data?.data || response.data;
  return Array.isArray(data) ? data : [];
}

export function useEligibleStudentsQuery(slug: string, eventId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).certificates.eligibleStudents(eventId),
    queryFn: () => fetchEligibleStudents(slug, eventId),
    enabled: !!slug && !!eventId && enabled,
  });
}

/**
 * Method A: Issue an individual certificate PDF for a registered student.
 */
export async function issueIndividualCertificateApi(
  slug: string,
  eventId: string,
  userId: string,
  file: File
): Promise<EventCertificate> {
  const formData = new FormData();
  formData.append('userId', userId);
  formData.append('file', file);

  const response = await apiClient.post(`/manager/events/${eventId}/certificates/individual`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data?.data || response.data;
}

export function useIssueIndividualCertificateMutation(slug: string, eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, file }: { userId: string; file: File }) =>
      issueIndividualCertificateApi(slug, eventId, userId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).certificates.all });
    },
  });
}

/**
 * Method B: Upload bulk certificates ZIP archive with manifest.csv.
 */
export async function uploadBulkCertificatesApi(
  slug: string,
  eventId: string,
  archiveFile: File
): Promise<CertificateBatch> {
  const formData = new FormData();
  formData.append('archive', archiveFile);

  const response = await apiClient.post(`/manager/events/${eventId}/certificates/bulk`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data?.data || response.data;
}

export function useUploadBulkCertificatesMutation(slug: string, eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (archiveFile: File) => uploadBulkCertificatesApi(slug, eventId, archiveFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).certificates.all });
    },
  });
}

/**
 * Method C: Save Certificate Template.
 */
export async function saveCertificateTemplateApi(
  slug: string,
  eventId: string,
  templateName: string,
  placeholderConfig: PlaceholderConfigItem[],
  templateFile: File
): Promise<EventCertificateTemplate> {
  const formData = new FormData();
  formData.append('template', templateFile);
  formData.append('templateName', templateName);
  formData.append('placeholderConfig', JSON.stringify(placeholderConfig));

  const response = await apiClient.post(`/manager/events/${eventId}/certificates/template`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data?.data || response.data;
}

/**
 * Method C: Preview Certificate Template with text overlays.
 */
export async function previewCertificateTemplateApi(
  slug: string,
  eventId: string,
  placeholderConfig: PlaceholderConfigItem[],
  sampleData?: Record<string, string>,
  templateId?: string,
  templateFile?: File
): Promise<Blob> {
  const formData = new FormData();
  if (templateFile) {
    formData.append('template', templateFile);
  }
  if (templateId) {
    formData.append('templateId', templateId);
  }
  formData.append('placeholderConfig', JSON.stringify(placeholderConfig));
  if (sampleData) {
    formData.append('sampleData', JSON.stringify(sampleData));
  }

  const response = await apiClient.post(`/manager/events/${eventId}/certificates/template/preview`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Method C: Batch Generate Certificates from template.
 */
export async function generateCertificatesFromTemplateApi(
  slug: string,
  eventId: string,
  templateId: string,
  studentUserIds?: string[] | null
): Promise<CertificateBatch> {
  const response = await apiClient.post(`/manager/events/${eventId}/certificates/generate`, {
    templateId,
    studentUserIds,
  });
  return response.data?.data || response.data;
}

export function useGenerateCertificatesMutation(slug: string, eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, studentUserIds }: { templateId: string; studentUserIds?: string[] | null }) =>
      generateCertificatesFromTemplateApi(slug, eventId, templateId, studentUserIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).certificates.all });
    },
  });
}

/**
 * Revoke an existing certificate with reason.
 */
export async function revokeCertificateApi(
  slug: string,
  eventId: string,
  certificateId: string,
  reason: string
): Promise<EventCertificate> {
  const response = await apiClient.post(`/manager/events/${eventId}/certificates/${certificateId}/revoke`, {
    reason,
  });
  return response.data?.data || response.data;
}

export function useRevokeCertificateMutation(slug: string, eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ certificateId, reason }: { certificateId: string; reason: string }) =>
      revokeCertificateApi(slug, eventId, certificateId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).certificates.all });
    },
  });
}

/**
 * Reissue a certificate with a replacement PDF file.
 */
export async function reissueCertificateApi(
  slug: string,
  eventId: string,
  certificateId: string,
  file: File
): Promise<EventCertificate> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post(
    `/manager/events/${eventId}/certificates/${certificateId}/reissue`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return response.data?.data || response.data;
}

export function useReissueCertificateMutation(slug: string, eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ certificateId, file }: { certificateId: string; file: File }) =>
      reissueCertificateApi(slug, eventId, certificateId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant(slug).certificates.all });
    },
  });
}

