import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './axios';
import { queryKeys } from './queryKeys';
import {
  getStoredExternalToken,
  setStoredExternalToken,
  clearStoredExternalToken,
} from '../auth/tokenStorage';
import type { Event, EventRegistration, EventCertificate, PublicCertificateVerification } from '@/types/models';

/**
 * Fetches all upcoming events for the active college tenant.
 */
export async function fetchUpcomingEvents(): Promise<Event[]> {
  const response = await apiClient.get('/events/upcoming');
  const res = response.data;
  if (Array.isArray(res)) return res as Event[];
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as Record<string, unknown>;
      if (Array.isArray(nested.events)) return nested.events as Event[];
    }
    if (Array.isArray(obj.events)) return obj.events as Event[];
  }
  return [];
}

/**
 * Fetches upcoming events for a specific club.
 */
export async function fetchClubUpcomingEvents(clubId: string): Promise<Event[]> {
  const response = await apiClient.get(`/clubs/${clubId}/events/upcoming`);
  const res = response.data;
  if (Array.isArray(res)) return res as Event[];
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as Record<string, unknown>;
      if (Array.isArray(nested.events)) return nested.events as Event[];
    }
    if (Array.isArray(obj.events)) return obj.events as Event[];
  }
  return [];
}

/**
 * Fetches past events for a specific club.
 */
export async function fetchClubPastEvents(clubId: string): Promise<Event[]> {
  const response = await apiClient.get(`/clubs/${clubId}/events/past`);
  const res = response.data;
  if (Array.isArray(res)) return res as Event[];
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as Record<string, unknown>;
      if (Array.isArray(nested.events)) return nested.events as Event[];
    }
    if (Array.isArray(obj.events)) return obj.events as Event[];
  }
  return [];
}

/**
 * Fetches a single public event.
 */
export async function fetchClubEvent(clubId: string, eventId: string): Promise<Event> {
  const response = await apiClient.get(`/clubs/${clubId}/events/${eventId}`);
  const res = response.data;
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as Record<string, unknown>;
      if (nested.event) return nested.event as Event;
    }
    if (obj.event) return obj.event as Event;
  }
  return res as Event;
}

/**
 * Query hook for all upcoming tenant events scoped to slug.
 */
export function useUpcomingEvents(slug: string) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).events.upcoming(),
    queryFn: fetchUpcomingEvents,
    enabled: !!slug,
  });
}

/**
 * Query hook for a club's upcoming events.
 */
export function useClubUpcomingEvents(slug: string, clubId: string) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).events.byClubUpcoming(clubId),
    queryFn: () => fetchClubUpcomingEvents(clubId),
    enabled: !!slug && !!clubId,
  });
}

/**
 * Query hook for a club's past events.
 */
export function useClubPastEvents(slug: string, clubId: string) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).events.byClubPast(clubId),
    queryFn: () => fetchClubPastEvents(clubId),
    enabled: !!slug && !!clubId,
  });
}

/**
 * Query hook for a single club event.
 */
export function useClubEvent(slug: string, clubId: string, eventId: string) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).events.detail(clubId, eventId),
    queryFn: () => fetchClubEvent(clubId, eventId),
    enabled: !!slug && !!clubId && !!eventId,
  });
}

/**
 * Registers the current authenticated user for an event.
 */
export async function registerForEvent(
  eventId: string,
  formAnswers?: Record<string, unknown>
) {
  const response = await apiClient.post(
    `/events/${eventId}/register`,
    formAnswers ? { formAnswers } : {}
  );
  return response.data;
}

/**
 * Cancels registration for the current user.
 */
export async function cancelRegistration(eventId: string) {
  const response = await apiClient.delete(`/events/${eventId}/register`);
  return response.data;
}

export interface TeamLeaderInfo {
  name?: string;
  email?: string;
  rollNumber?: string;
  phone?: string;
  institutionName?: string;
}

export interface TeamMemberInfo {
  name: string;
  email: string;
  rollNumber?: string;
  department?: string;
  collegeName?: string;
}

export interface RegistrationStatusResponse {
  isRegistered: boolean;
  isLeader?: boolean;
  isTeamMember?: boolean;
  isTeamRegistration?: boolean;
  teamName?: string | null;
  teamSize?: number;
  teamLeader?: TeamLeaderInfo | null;
  teamMembers?: TeamMemberInfo[];
  myDetails?: TeamMemberInfo | null;
  registration?: {
    id: string;
    eventId: string;
    userId?: string | null;
    registeredAt: string;
  } | null;
}

/**
 * Checks whether the current user is registered for the specified event.
 */
export async function getMyRegistrationStatus(
  eventId: string
): Promise<RegistrationStatusResponse> {
  const response = await apiClient.get(`/events/${eventId}/my-registration`);
  const res = response.data;
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object') {
      return obj.data as RegistrationStatusResponse;
    }
  }
  return res as RegistrationStatusResponse;
}

/**
 * Lists all registrations for the authenticated user within the tenant.
 */
export async function listMyRegistrations(): Promise<EventRegistration[]> {
  const response = await apiClient.get('/events/my-registrations');
  const res = response.data;
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (Array.isArray(obj.registrations)) {
      return obj.registrations as EventRegistration[];
    }
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as Record<string, unknown>;
      if (Array.isArray(nested.registrations)) {
        return nested.registrations as EventRegistration[];
      }
    }
  }
  return [];
}

/**
 * Query hook checking if the current student is registered for an event.
 */
export function useMyRegistrationStatus(slug: string, eventId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).registrations.status(eventId),
    queryFn: () => getMyRegistrationStatus(eventId),
    enabled: !!slug && !!eventId && enabled,
  });
}

/**
 * Query hook fetching all registrations of the authenticated student.
 */
export function useMyRegistrationsQuery(slug: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).registrations.myRegistrations(),
    queryFn: () => listMyRegistrations(),
    enabled: !!slug && enabled,
  });
}

/**
 * Mutation hook to register for an event.
 */
export function useRegisterForEventMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: string | { eventId: string; formAnswers?: Record<string, unknown> }) => {
      const eventId = typeof variables === 'string' ? variables : variables.eventId;
      const formAnswers = typeof variables === 'object' ? variables.formAnswers : undefined;
      return registerForEvent(eventId, formAnswers);
    },
    onSuccess: (_data, variables) => {
      const eventId = typeof variables === 'string' ? variables : variables.eventId;
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).registrations.status(eventId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).registrations.myRegistrations(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).events.all,
      });
    },
  });
}

/**
 * Mutation hook to cancel registration for an event.
 */
export function useCancelRegistrationMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => cancelRegistration(eventId),
    onSuccess: (_data, eventId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).registrations.status(eventId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).registrations.myRegistrations(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).events.all,
      });
    },
  });
}

// ============================================================================
// Student Certificates & Public Verification
// ============================================================================

/**
 * Fetches all issued certificates for the logged-in student.
 */
export async function fetchMyCertificates(): Promise<EventCertificate[]> {
  const response = await apiClient.get('/certificates/my');
  const res = response.data;
  if (Array.isArray(res)) return res as EventCertificate[];
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as EventCertificate[];
  }
  return [];
}

export function useMyCertificatesQuery(slug: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).certificates.myCertificates(),
    queryFn: () => fetchMyCertificates(),
    enabled: !!slug && enabled,
  });
}

/**
 * Public Verification API (no auth required).
 */
export async function verifyCertificatePublic(certificateNumber: string): Promise<PublicCertificateVerification> {
  const response = await apiClient.get(`/certificates/verify/${encodeURIComponent(certificateNumber.trim())}`);
  return response.data?.data || response.data;
}

export function useVerifyCertificateQuery(slug: string, certificateNumber: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).certificates.verify(certificateNumber),
    queryFn: () => verifyCertificatePublic(certificateNumber),
    enabled: !!certificateNumber && enabled,
  });
}

// ============================================================================
// Phase 3 — External Participant Registration API & Hooks
// ============================================================================

export interface ExternalRegisterInput {
  name: string;
  phone?: string | null;
  institutionName?: string | null;
  formAnswers?: Record<string, unknown> | null;
}

export interface ExternalRegistrationStatusResponse extends RegistrationStatusResponse {}

/**
 * Requests an OTP for external participant verification.
 * The backend Derives hostCollegeId from the event, sends an email with the OTP,
 * and resists email enumeration via constant-time timing jitter and a generic 200 response.
 */
export async function requestExternalOtp(
  eventId?: string | null,
  email?: string
): Promise<{ success: boolean; message: string }> {
  const payload: { email: string; eventId?: string } = {
    email: (email || '').trim().toLowerCase(),
  };
  if (eventId) {
    payload.eventId = eventId;
  }
  const response = await apiClient.post('/external/otp/request', payload);
  return response.data;
}

/**
 * Verifies the 6-digit OTP code submitted by the guest.
 * On success, receives a short-lived signed external JWT and securely caches it in sessionStorage.
 */
export async function verifyExternalOtp(
  email: string,
  code: string,
  eventId?: string
): Promise<{ success: boolean; token: string }> {
  const response = await apiClient.post('/external/otp/verify', {
    email: email.trim().toLowerCase(),
    code: code.trim(),
    ...(eventId ? { eventId } : {}),
  });
  const data = response.data;
  if (data?.token) {
    setStoredExternalToken(data.token);
  }
  return data;
}

/**
 * Completes registration for an external participant using the verified external JWT.
 * Fails safely if externalToken is missing or expired.
 */
export async function registerExternalParticipant(
  eventId: string,
  input: ExternalRegisterInput,
  externalToken?: string
): Promise<{ success: boolean; message: string; registration: { id: string; eventId: string; registeredAt: string } }> {
  const token = externalToken || getStoredExternalToken();
  if (!token) {
    throw {
      status: 401,
      message: 'Verification required: please verify your email before registering.',
    };
  }

  const response = await apiClient.post(
    `/external/events/${eventId}/register`,
    {
      name: input.name.trim(),
      phone: input.phone?.trim() || undefined,
      institutionName: input.institutionName?.trim() || undefined,
      formAnswers: input.formAnswers || undefined,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
}

/**
 * Cancels registration for an external participant using their external JWT.
 */
export async function cancelExternalRegistration(
  eventId: string,
  externalToken?: string
): Promise<{ success: boolean; message: string }> {
  const token = externalToken || getStoredExternalToken();
  if (!token) {
    throw {
      status: 401,
      message: 'Authentication token required to cancel registration.',
    };
  }

  const response = await apiClient.delete(`/external/events/${eventId}/register`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}

/**
 * Checks external participant registration status for a given event.
 * If token is missing, expired, or rejected with 401, silently clears token and reports isRegistered: false.
 */
export async function getExternalRegistrationStatus(
  eventId: string,
  externalToken?: string
): Promise<ExternalRegistrationStatusResponse> {
  const token = externalToken || getStoredExternalToken();
  if (!token) {
    return { isRegistered: false, registration: null };
  }

  try {
    const response = await apiClient.get(`/external/events/${eventId}/my-registration`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const res = response.data;
    return {
      isRegistered: Boolean(res.isRegistered),
      registration: res.registration || null,
    };
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 401) {
      clearStoredExternalToken();
      return { isRegistered: false, registration: null };
    }
    throw err;
  }
}

/**
 * Query hook for external guest registration status.
 */
export function useExternalRegistrationStatus(eventId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.external.registrationStatus(eventId),
    queryFn: () => getExternalRegistrationStatus(eventId),
    enabled: !!eventId && enabled,
  });
}

/**
 * Mutation hook to register an external participant.
 */
export function useRegisterExternalMutation(slug?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { eventId: string; input: ExternalRegisterInput; externalToken?: string }) =>
      registerExternalParticipant(variables.eventId, variables.input, variables.externalToken),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.external.registrationStatus(variables.eventId),
      });
      if (slug) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.tenant(slug).events.all,
        });
      }
    },
  });
}

/**
 * Mutation hook to cancel external participant registration.
 */
export function useCancelExternalMutation(slug?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { eventId: string; externalToken?: string }) =>
      cancelExternalRegistration(variables.eventId, variables.externalToken),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.external.registrationStatus(variables.eventId),
      });
      if (slug) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.tenant(slug).events.all,
        });
      }
    },
  });
}

/**
 * Fetches a single public event by ID.
 */
export async function fetchPublicEventById(eventId: string): Promise<Event> {
  const response = await apiClient.get(`/events/${eventId}`);
  const res = response.data;
  return res?.event || res?.data?.event || res;
}

export function usePublicEventById(eventId: string, enabled = true) {
  return useQuery({
    queryKey: ['public', 'events', 'detail', eventId] as const,
    queryFn: () => fetchPublicEventById(eventId),
    enabled: !!eventId && enabled,
  });
}

