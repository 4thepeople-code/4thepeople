/**
 * Centralized, structured query key definitions for TanStack Query.
 * All college-tenant queries explicitly include the validated tenant slug to enforce
 * cryptographic cache isolation across multi-tenant subdomains.
 *
 * Platform administration queries are partitioned under a distinct 'platform' root.
 */
export const queryKeys = {
  // Tenant-scoped domain queries
  tenant: (slug: string) => ({
    all: ['tenant', slug] as const,

    departments: {
      all: ['tenant', slug, 'departments'] as const,
      lists: () => ['tenant', slug, 'departments', 'list'] as const,
      detail: (id: string) => ['tenant', slug, 'departments', 'detail', id] as const,
    },

    clubs: {
      all: ['tenant', slug, 'clubs'] as const,
      lists: () => ['tenant', slug, 'clubs', 'list'] as const,
      detail: (id: string) => ['tenant', slug, 'clubs', 'detail', id] as const,
      dashboard: (clubId: string) => ['tenant', slug, 'clubs', 'dashboard', clubId] as const,
      managers: (clubId: string) => ['tenant', slug, 'clubs', 'managers', clubId] as const,
    },

    events: {
      all: ['tenant', slug, 'events'] as const,
      upcoming: () => ['tenant', slug, 'events', 'upcoming'] as const,
      past: () => ['tenant', slug, 'events', 'past'] as const,
      byClubUpcoming: (clubId: string) =>
        ['tenant', slug, 'events', 'club', clubId, 'upcoming'] as const,
      byClubPast: (clubId: string) =>
        ['tenant', slug, 'events', 'club', clubId, 'past'] as const,
      detail: (clubId: string, eventId: string) =>
        ['tenant', slug, 'events', 'club', clubId, 'event', eventId] as const,
    },

    registrations: {
      all: ['tenant', slug, 'registrations'] as const,
      myRegistrations: () => ['tenant', slug, 'registrations', 'mine'] as const,
      status: (eventId: string) =>
        ['tenant', slug, 'registrations', 'status', eventId] as const,
      attendees: (clubId: string, eventId: string) =>
        ['tenant', slug, 'registrations', 'attendees', clubId, eventId] as const,
    },

    auth: {
      all: ['tenant', slug, 'auth'] as const,
      session: () => ['tenant', slug, 'auth', 'session'] as const,
      profile: () => ['tenant', slug, 'auth', 'profile'] as const,
    },

    manager: {
      all: ['tenant', slug, 'manager'] as const,
      myClubs: () => ['tenant', slug, 'manager', 'my-clubs'] as const,
      clubDashboard: (clubId: string) => ['tenant', slug, 'manager', 'club', clubId, 'dashboard'] as const,
      clubEvents: (clubId: string) => ['tenant', slug, 'manager', 'club', clubId, 'events'] as const,
      profile: () => ['tenant', slug, 'manager', 'profile'] as const,
      attendees: (clubId: string, eventId: string, page = 1) =>
        ['tenant', slug, 'manager', 'club', clubId, 'event', eventId, 'attendees', page] as const,
    },

    certificates: {
      all: ['tenant', slug, 'certificates'] as const,
      myCertificates: () => ['tenant', slug, 'certificates', 'mine'] as const,
      eventCertificates: (eventId: string, page = 1, status = 'ALL', search = '') =>
        ['tenant', slug, 'certificates', 'event', eventId, page, status, search] as const,
      eligibleStudents: (eventId: string) =>
        ['tenant', slug, 'certificates', 'event', eventId, 'eligible-students'] as const,
      verify: (certificateNumber: string) =>
        ['public', 'certificates', 'verify', certificateNumber] as const,
    },

    admin: {
      all: ['tenant', slug, 'admin'] as const,
      profile: () => ['tenant', slug, 'admin', 'profile'] as const,
      users: () => ['tenant', slug, 'admin', 'users'] as const,
      userDetail: (id: string) => ['tenant', slug, 'admin', 'users', id] as const,
      clubs: () => ['tenant', slug, 'admin', 'clubs'] as const,
      clubDetail: (id: string) => ['tenant', slug, 'admin', 'clubs', id] as const,
      clubManagers: (clubId: string) => ['tenant', slug, 'admin', 'clubs', clubId, 'managers'] as const,
      departments: () => ['tenant', slug, 'admin', 'departments'] as const,
    },
  }),

  // Platform administration queries (strictly isolated from college tenants)
  platform: {
    all: ['platform'] as const,
    session: () => ['platform', 'session'] as const,
    admins: () => ['platform', 'admins', 'list'] as const,
    colleges: () => ['platform', 'colleges', 'list'] as const,
    collegeDetail: (id: string) => ['platform', 'colleges', 'detail', id] as const,
  },
};
