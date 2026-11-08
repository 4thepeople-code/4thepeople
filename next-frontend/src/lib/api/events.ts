import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './axios';
import { queryKeys } from './queryKeys';
import type { Event, EventRegistration } from '@/types/models';

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

/**
 * Checks whether the current user is registered for the specified event.
 */
export async function getMyRegistrationStatus(
  eventId: string
): Promise<{ isRegistered: boolean; registration?: unknown }> {
  const response = await apiClient.get(`/events/${eventId}/my-registration`);
  const res = response.data;
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if (obj.data && typeof obj.data === 'object') {
      return obj.data as { isRegistered: boolean; registration?: unknown };
    }
  }
  return res as { isRegistered: boolean; registration?: unknown };
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
