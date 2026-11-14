/**
 * Central UX copy for the dashboards (Phase 1+).
 *
 * Rules (from the product brief):
 * - Buttons start with a verb and are specific ("Create event", not "Submit").
 * - Errors: what happened + why + how to fix. Never blame the user.
 * - Empty states: what this is + why it's empty + the first action.
 * - Confirmations name the object and the consequence.
 * - Same term for the same thing: College Admin, Event Manager, Student,
 *   Department, Club, Event.
 *
 * Phase 1 ships shell/nav/kit strings; later phases append their screen copy
 * here so nothing is ever edited in a component.
 */

export const brand = {
  name: '4 the people',
};

export const roleNames = {
  collegeAdmin: 'College Admin',
  eventManager: 'Event Manager',
  student: 'Student',
  superAdmin: 'Super Admin',
} as const;

export type RoleName = keyof typeof roleNames;

export const actions = {
  addClub: 'Add club',
  createEvent: 'Create event',
  inviteManager: 'Invite manager',
  register: 'Register',
  browseEvents: 'Browse events',
  addCollege: 'Add college',
  cancel: 'Cancel',
  close: 'Close',
  save: 'Save',
  saveChanges: 'Save changes',
  delete: 'Delete',
  keep: 'Keep',
  undo: 'Undo',
  retry: 'Try again',
  logOut: 'Log out',
  goToLogin: 'Go to login',
  backToDashboard: 'Back to dashboard',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
} as const;

export const shell = {
  skipToContent: 'Skip to content',
  openMenu: 'Open navigation menu',
  closeMenu: 'Close navigation menu',
  mainNavLabel: 'Dashboard navigation',
  userMenuLabel: 'Account',
  signedInAs: 'Signed in as',
  drawerLabel: 'Navigation menu',
  closeDrawer: 'Close menu',
} as const;

export const theme = {
  toggleToDark: 'Switch to dark mode',
  toggleToLight: 'Switch to light mode',
} as const;

export const nav = {
  sections: {
    main: 'Main',
    account: 'Account',
  },
} as const;

/** Empty states: what this is + why it's empty + the first action. */
export const emptyStates = {
  generic: {
    title: 'Nothing here yet',
    description: 'This space fills in as your college starts using 4 the people.',
  },
  noSearchResults: {
    title: 'No matches found',
    description: 'Try a different search term or clear the filters to see everything.',
  },
  loadingFailed: {
    title: "This didn't load",
    description: 'The request to the server failed or timed out. Check your connection and try again.',
  },
  wrongWorkspace: {
    title: 'This is a different workspace',
    description: 'Your account has access to another dashboard. Taking you there now.',
  },
} as const;

/** Errors: what happened + why + how to fix. Never blame the user. */
export const errors = {
  network: 'Something went wrong reaching the server. Check your connection and try again.',
  unauthorized: 'Your session has expired. Log in again to continue where you left off.',
  forbidden: "Your account doesn't have access to this workspace.",
  unexpected: 'Something unexpected happened on our side. Please try again.',
} as const;

export const toasts = {
  dismiss: 'Dismiss notification',
} as const;

export const guard = {
  authChecking: 'Checking your session…',
  authRequiredTitle: 'Log in to continue',
  authRequiredDescription: 'This dashboard needs a signed-in session. Log in and we will bring you right back here.',
  platformDeniedTitle: 'Super Admin access only',
  platformDeniedDescription: (role: string) =>
    `You are signed in as ${role}. College accounts can't open platform operations. Sign out and switch to a Super Admin account to continue.`,
  signOutAndSwitch: 'Sign out & switch account',
  returnToPublicSite: 'Return to public site',
} as const;

/**
 * Super Admin (platform) screens: /admin, /admin/colleges, /admin/admins.
 * Term note: the platform role is "Super Admin"; the per-college role is
 * "College Admin" — never "admin" alone.
 */
export const superAdmin = {
  overview: {
    title: 'Platform overview',
    description:
      'Colleges onboarded to 4 the people, their College Admins, and the platform security posture.',
    verifySession: 'Verify session',
    verifyingSession: 'Verifying session…',
    sessionVerified: 'Session verified with the platform backend.',
    sessionFailed:
      "Session verification failed — the backend didn't respond. Check your connection and try again.",
    statColleges: 'Colleges',
    statActiveColleges: 'Active colleges',
    statAwaitingAdmin: 'Colleges awaiting an admin',
    statPendingInvites: 'Invites awaiting activation',
    honestNote:
      'Counts are tallied from the colleges list below. Platform-wide student and event totals need a dedicated backend endpoint.',
    onboardedTitle: 'Onboarded colleges',
    onboardedDescription: 'Every college registered on the platform and its College Admin assignment.',
    openColleges: 'Manage colleges',
    securityTitle: 'Security controls',
    securityDescription: 'How platform sessions stay isolated from college accounts.',
    securityHost: 'Host isolation',
    securityHostDetail:
      'Platform sign-in is only accepted from the admin host. College subdomains cannot authenticate here.',
    securityToken: 'Separate signing key',
    securityTokenDetail:
      'Platform sessions are signed with a dedicated platform secret, separate from the college secret.',
    securityReplay: 'TOTP anti-replay',
    securityReplayDetail: 'Two-factor codes reused inside the rotating window are rejected.',
    noCollegesTitle: 'No colleges yet',
    noCollegesDescription:
      'Add the first college so its College Admin can be invited and its students can start using 4 the people.',
  },

  colleges: {
    title: 'Colleges',
    description:
      'Add colleges, invite their College Admins, and control whether each college portal is live.',
    addCollege: 'Add college',
    editCollege: 'Edit details',
    viewCollege: 'View details',
    assignAdmin: 'Assign College Admin',
    resendInvite: 'Resend invite',
    suspendAdmin: 'Suspend College Admin',
    reactivateAdmin: 'Reactivate College Admin',
    switchActivate: (name: string) => `Activate ${name}'s college portal`,
    switchDeactivate: (name: string) => `Deactivate ${name}'s college portal`,
    searchPlaceholder: 'Search by college name or code',
    filterCollegeStatus: 'College status',
    filterAdminStatus: 'College Admin status',
    filterAllCollegeStatuses: 'All college statuses',
    filterActiveOnly: 'Active colleges only',
    filterInactiveOnly: 'Deactivated colleges only',
    filterAllAdminStatuses: 'All College Admin statuses',
    tableCollege: 'College',
    tableLocation: 'Location',
    tableStatus: 'Status',
    tableAdmin: 'College Admin',
    tableAdminStatus: 'Admin status',
    tableActions: 'Actions',
    statusActive: 'Active',
    statusDeactivated: 'Deactivated',
    locationUnassigned: 'Location not set',
    noAdminAssigned: 'No College Admin assigned',
    adminStatusLabel: {
      NOT_ASSIGNED: 'Not assigned',
      PENDING_ACTIVATION: 'Pending activation',
      INVITATION_EXPIRED: 'Invitation expired',
      ACTIVE: 'Active',
      SUSPENDED: 'Suspended',
    } as Record<string, string>,
    emptyTitle: 'No colleges match',
    emptyDescription: 'No colleges match the current search or filters.',
    emptyFix: 'Clear the search and filters to see every college, or add a new one.',
    clearFilters: 'Clear search & filters',
    // Add/edit form
    formName: 'College name',
    formNamePlaceholder: 'e.g. Lakireddy Bali Reddy College of Engineering',
    formCode: 'College code',
    formCodePlaceholder: 'e.g. LBRCE',
    formCodeHint: 'Short uppercase code identifying the college, e.g. LBRCE.',
    formOfficialEmail: 'Official email',
    formOfficialEmailPlaceholder: 'contact@college.ac.in',
    formContactNumber: 'Contact number',
    formAddress: 'Campus address',
    formCity: 'City',
    formState: 'State',
    formAdminSection: 'Assign College Admin now (optional)',
    formAdminSectionHint:
      "Off: create the college only. You can assign a College Admin afterwards on this page.",
    formAdminName: 'College Admin full name',
    formAdminEmail: 'College Admin official email',
    formAdminEmailHint:
      'A single-use activation invite, valid for 48 hours, is emailed to this address.',
    createCollege: 'Create college',
    createCollegeAndInvite: 'Create college & send invite',
    createCollegeOnly: 'Create college only',
    sendInvite: 'Send invite',
    errNameCodeRequired: 'Enter a college name and code — both are required to create a college.',
    errAdminFieldsRequired:
      "Enter the College Admin's full name and official email, or turn off assigning an admin now.",
    // Toasts & errors (what + why + fix)
    toastCollegeCreated: 'College created.',
    toastCollegeUpdated: 'College details saved.',
    toastCollegeActivated: (name: string) => `${name} is now live.`,
    toastCollegeDeactivated: (name: string) => `${name} was deactivated. Students and staff lose access until it is reactivated.`,
    toastInviteResent: (name: string) => `Invite resent to the College Admin of ${name} with a fresh 48-hour expiry.`,
    toastAdminProvisioned: (name: string) => `College Admin invited for ${name}. They appear as Pending activation until they accept.`,
    toastAdminSuspended: (name: string) => `${name} can no longer sign in to the college admin portal.`,
    toastAdminReactivated: (name: string) => `${name} can sign in to the college admin portal again.`,
    errCreate: "The college couldn't be created. The server rejected the request — check the details and try again.",
    errUpdate: "College details weren't saved. The server didn't respond — try again in a moment.",
    errToggle: "The college's status didn't change. The server didn't respond — try again in a moment.",
    errProvision: "The invite couldn't be sent. Check the email address and try again.",
    errResend: "The invite wasn't resent. The server didn't respond — try again in a moment.",
    errAdminToggle: "The College Admin's status didn't change. The server didn't respond — try again in a moment.",
    loadingLabel: 'Loading colleges',
    // View-details modal labels
    viewTitle: 'College details',
    viewCode: 'Code',
    viewEmail: 'Official email',
    viewPhone: 'Contact number',
    viewAddress: 'Address',
    viewCity: 'City',
    viewState: 'State',
    viewCreated: 'Added on',
    viewPortal: 'College portal address',
  },

  admins: {
    title: 'Platform admins',
    description:
      'Super Admins with full platform access. Each signs in with email, password and a two-factor code.',
    addAdmin: 'Add platform admin',
    myAuthenticator: 'My authenticator (2FA)',
    tableAdmin: 'Admin',
    tableStatus: 'Status',
    tableTotp: 'Two-factor',
    tableCreated: 'Added on',
    statusActive: 'Active',
    statusDisabled: 'Disabled',
    totpEnrolled: 'Enrolled',
    totpPending: 'Not enrolled yet',
    selfBadge: 'You',
    selfToggleHint: "You can't change your own account here. Ask another Super Admin.",
    reset2fa: 'Reset 2FA',
    addTitle: 'Add platform admin',
    addDescription:
      'Creates a Super Admin sign-in. The new admin must enroll a two-factor app at their first sign-in.',
    formName: 'Full name',
    formNamePlaceholder: 'e.g. Irfan Jan Khan',
    formEmail: 'Email',
    formEmailPlaceholder: 'admin@platform.org',
    formPassword: 'Initial password',
    formPasswordHint: 'At least 8 characters.',
    createAccount: 'Create account',
    errAllFieldsRequired: 'Enter a name, email and initial password — all three are required.',
    errPasswordLength: 'The initial password must be at least 8 characters.',
    toastAdminCreated: 'Platform admin created.',
    toastAdminActivated: (name: string) => `${name} can sign in to the platform again.`,
    toastAdminDeactivated: (name: string) => `${name} can no longer sign in to the platform.`,
    switchActivate: (name: string) => `Activate ${name}'s platform access`,
    switchDeactivate: (name: string) => `Deactivate ${name}'s platform access`,
    errToggle: "The admin's status didn't change. The server didn't respond — try again in a moment.",
    errTotpReset: "The 2FA reset didn't go through. The server didn't respond — try again in a moment.",
    resetTitle: (name: string) => `Reset 2FA for ${name}?`,
    resetBody: (email: string) =>
      `This clears the authenticator key linked to ${email}. They will be locked out until they set up two-factor sign-in again.`,
    toastTotpReset: (name: string) => `Two-factor reset for ${name}. They must enroll again at their next sign-in.`,
    enrollTitle: 'Set up your authenticator',
    enrollDescription:
      'Add the key below to Google Authenticator, 1Password or Authy, then confirm with a 6-digit code.',
    enrollSecretLabel: 'Manual key (Base32)',
    copy: 'Copy',
    copied: 'Copied',
    liveCodeLabel: 'Current code',
    liveCodeValid: (seconds: number) => `valid ~${seconds}s`,
    enrollCodeLabel: 'Enter the 6-digit code to confirm',
    confirmEnroll: 'Confirm & activate',
    toastEnrolled: 'Two-factor sign-in is now active for your account.',
    errEnrollCode: 'Enter the 6-digit code from your authenticator app.',
    errEnrollInvalid: "That code didn't match. Codes rotate every 30 seconds — enter the current one and try again.",
    errEnrollStart: "Authenticator setup couldn't start. The server didn't respond — try again in a moment.",
    emptyTitle: 'No platform admins yet',
    emptyDescription: 'Add the first platform admin to manage colleges and their College Admins.',
  },
} as const;
