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
  inviteManager: 'Invite Event Manager',
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

/**
 * College Admin screens: /college/[slug]/admin/* (overview, accounts, clubs,
 * departments, roster, profile). Term rules: the role is "College Admin";
 * club managers are "Event Manager"; students are "Students".
 */
export const collegeAdmin = {
  dashboard: {
    title: 'Overview',
    description:
      'A live count of the accounts, clubs and Event Managers at your college, plus shortcuts to the most common tasks.',
    statAccounts: 'Accounts',
    statAccountsHint: 'Students, Event Managers and the College Admin provisioned for this college.',
    statClubs: 'Clubs',
    statClubsHint: 'Recognised student organisations, central and departmental.',
    statManagers: 'Event Managers',
    statManagersHint: 'Assigned or invited to at least one club (pending accounts included).',
    recentClubs: 'Recent clubs',
    viewAllClubs: 'View all clubs',
    recentClubsHint: 'The five most recently created clubs.',
    noClubsTitle: 'No clubs yet',
    noClubsDescription:
      'Clubs are where students organise events. Create the first one so departments and students have somewhere to gather.',
    viewClub: 'View club',
    quickActions: 'Quick actions',
    createClub: 'Create a club',
    createClubHint: 'Set up a new student organisation.',
    inviteManager: 'Invite an Event Manager',
    inviteManagerHint: 'Email an invite link for manager setup.',
    uploadRoster: 'Upload the student roster',
    uploadRosterHint: 'Batch-import student accounts for self-activation.',
    reviewAccounts: 'Review accounts',
    reviewAccountsHint: 'Search, inspect or remove college accounts.',
    chipCentral: 'Central',
    chipDepartmental: 'Departmental',
    noDescription: 'No description yet',
  },

  users: {
    title: 'Accounts',
    description:
      'Every account at this college — Students, Event Managers and College Admins — with their status.',
    searchPlaceholder: 'Search by name, email, roll number or role',
    refresh: 'Refresh list',
    loadingLabel: 'Loading accounts',
    tableUser: 'Account',
    tableRole: 'Role',
    tableStatus: 'Status',
    tableCreated: 'Created',
    tableActions: 'Actions',
    statusActive: 'Active',
    statusPending: 'Pending invite / claim',
    viewDetails: 'View details',
    delete: 'Delete account',
    emptyTitle: 'No accounts yet',
    emptyDescription:
      'Accounts appear here after you upload the student roster or invite an Event Manager.',
    emptyAction: 'Upload roster',
    emptySearchTitle: 'No accounts match',
    emptySearchFix: 'Clear the search to see every account, or refresh the list.',
  },

  userDetail: {
    back: 'Back to accounts',
    managerBadge: (count: number) => `Event Manager · ${count}`,
    accountId: 'Account ID',
    delete: 'Delete account',
    profileTitle: 'Account profile',
    fullName: 'Full name',
    email: 'Email',
    role: 'Role',
    status: 'Status',
    statusActive: 'Active account',
    statusPending: 'Invitation pending',
    registered: 'Registered on',
    resendInvite: 'Resend invite',
    toastInviteResent:
      "Invite email sent again. Ask them to check their inbox — and spam — if nothing arrives.",
    errResendInvite:
      "The invite wasn't resent. The server didn't respond — try again in a moment.",
    associatedClubs: (count: number) => `Clubs (${count})`,
    clubsHint: 'Clubs this person manages or belongs to.',
    joined: 'Joined',
    viewClub: 'View club',
    noClubs: 'Not in any club yet. Memberships appear when they join a club or are invited to manage one.',
    noClubDescription: 'No description provided for this club.',
    loadingLabel: 'Loading account',
    loadFailedTitle: 'Account not found',
    loadFailedDescription:
      'This account may have been deleted. Go back to the account list and pick another one.',
    // OTP delete (names the account and the consequence)
    deleteTitle: (name: string) => `Delete ${name}'s account?`,
    deleteWarning:
      "This permanently removes their account, club memberships and activation data. It can't be undone.",
    confirmDelete: 'Delete account',
    toastDeleted: 'Account deleted.',
  },

  clubs: {
    title: 'Clubs',
    description: 'Every club at this college, its Department affiliations and its Event Managers.',
    searchPlaceholder: 'Search by club name or description',
    createClub: 'Create club',
    refresh: 'Refresh list',
    loadingLabel: 'Loading clubs',
    tableClub: 'Club',
    tableMembers: 'Members',
    tableCreated: 'Created',
    tableActions: 'Actions',
    members: (count: number) => (count === 1 ? '1 member' : `${count} members`),
    chipCentral: 'Central',
    manage: 'Manage club',
    edit: 'Edit details',
    delete: 'Delete club',
    emptyTitle: 'No clubs yet',
    emptyDescription:
      'Clubs are where students organise events. Create the first one so Departments and students have somewhere to gather.',
    emptySearchTitle: 'No clubs match',
    emptySearchFix: 'Clear the search to see every club, or create a new one.',
    // OTP delete (names the club and the consequence)
    deleteTitle: (name: string) => `Delete ${name}?`,
    deleteWarning:
      "This permanently deletes the club, its events, logo and memberships, following your college's deletion policy. It can't be undone.",
    confirmDelete: 'Delete club',
    toastDeleted: 'Club deleted.',
  },

  createClub: {
    title: 'Create club',
    description: 'Set up a new recognised campus organisation.',
    back: 'Back to clubs',
    formName: 'Club name',
    formNamePlaceholder: 'e.g. IEEE Student Branch',
    formDescription: 'Description',
    formDescriptionPlaceholder:
      "Briefly describe the club's purpose, mission and activities…",
    centralToggle: 'Central club (campus-wide, no Department)',
    centralHint:
      "Central clubs represent the whole college and aren't attached to any single Department.",
    departmentsLabel: 'Department affiliation',
    multiSelectPlaceholder: 'Select one or more Departments…',
    multiSelectDisabled: 'Not for central clubs',
    submit: 'Create club',
    submitting: 'Creating club…',
    errNameRequired: "Enter a club name — it's how Students recognise the club.",
    errCreate:
      "The club couldn't be created. The server rejected the request — check the details and try again.",
    toastCreated: 'Club created.',
  },

  clubDetail: {
    back: 'Back to clubs',
    edit: 'Edit club',
    delete: 'Delete club',
    infoTitle: 'Club information',
    created: 'Created',
    affiliation: 'Affiliation',
    centralAffiliation: 'Central club (campus-wide, no Department)',
    noAffiliation: 'No Department affiliation',
    description: 'Description',
    noDescription:
      'No description yet. Add one with "Edit club" so Students know what this club does.',
    managersTitle: (count: number) => `Event Managers (${count})`,
    managersHint: 'Event Managers can create events and manage attendees for this club.',
    addExisting: 'Add existing user',
    inviteNew: 'Invite new Event Manager',
    pendingInvite: 'Pending invite',
    noEmail: 'No email shown',
    roleLabel: 'Role',
    resendInvite: 'Resend invite',
    toastInviteResent:
      "Invite email sent again. Ask them to check their inbox — and spam — if nothing arrives.",
    errResendInvite:
      "The invite wasn't resent. The server didn't respond — try again in a moment.",
    remove: 'Remove',
    removeTitle: (name: string) => `Remove ${name} as Event Manager?`,
    removeBody: (clubName: string) =>
      `They'll no longer be able to manage events or attendees for ${clubName}. You can re-invite them any time.`,
    confirmRemove: 'Remove Event Manager',
    toastManagerRemoved: (name: string) => `${name} is no longer an Event Manager of this club.`,
    errRemoveManager:
      "The Event Manager wasn't removed. The server didn't respond — try again in a moment.",
    noManagers:
      'No Event Managers yet. Add one above so events can be created for this club.',
    loadingLabel: 'Loading club',
    loadFailedTitle: 'Club not found',
    loadFailedDescription:
      'This club may have been deleted. Go back to the club list and pick another one.',
    deleteTitle: (name: string) => `Delete ${name}?`,
    deleteWarning:
      'This permanently deletes the club, its events, logo and memberships. It cannot be undone.',
    confirmDelete: 'Delete club',
    toastDeleted: 'Club deleted.',
    // Edit modal
    editTitle: 'Edit club details',
    editDescription: 'Update the name, description, branding and Department affiliations.',
    logoLabel: 'Club logo',
    uploadLogo: 'Upload logo',
    changeFile: 'Change file',
    removeLogo: 'Remove logo',
    logoHint: 'PNG, JPG or WEBP, up to 5 MB.',
    formName: 'Club name',
    formDescription: 'Description',
    submitSave: 'Save changes',
    errNameRequired: 'Enter a club name.',
    errImage: 'Pick an image file (PNG, JPG or WEBP) for the logo.',
    errLogoRemove:
      "The logo wasn't removed. The server didn't respond — try again in a moment.",
    errSave:
      "Club details weren't saved. The server rejected part of the update — check the details and try again.",
    toastSaved: 'Club details saved.',
  },

  departments: {
    title: 'Departments',
    description:
      'Academic Departments, their short codes, and the clubs affiliated with each one.',
    create: 'Create department',
    refresh: 'Refresh list',
    searchPlaceholder: 'Search by name, short code or description',
    loadingLabel: 'Loading departments',
    tableDepartment: 'Department',
    tableShortCode: 'Short code',
    tableClubs: 'Clubs',
    tableActions: 'Actions',
    noDescription: 'No description',
    clubs: (count: number) => (count === 1 ? '1 club' : `${count} clubs`),
    edit: 'Edit',
    assign: 'Assign clubs',
    delete: 'Delete',
    emptyTitle: 'No Departments yet',
    emptyDescription:
      'Departments group clubs (e.g. all CSE clubs) and map roster Students to their branch. Create the first one.',
    emptySearchTitle: 'No Departments match',
    emptySearchFix: 'Clear the search to see every Department, or create a new one.',
    deleteTitle: (name: string) => `Delete ${name}?`,
    deleteWarning:
      "Every club affiliated with this Department loses its Department mapping — the clubs themselves aren't deleted. You can re-link clubs afterwards. This can't be undone.",
    confirmDelete: 'Delete department',
    toastDeleted: (name: string) => `${name} deleted.`,
    errDelete:
      "The Department wasn't deleted. The server didn't respond — try again in a moment.",
  },

  departmentForm: {
    createTitle: 'Create department',
    createDescription:
      'Add an academic Department — its short code maps roster Students to their branch.',
    editTitle: 'Edit department',
    editDescription: 'Update the name, short code or description.',
    formName: 'Department name',
    formNamePlaceholder: 'e.g. Computer Science & Engineering',
    formShortCode: 'Short code',
    formShortCodePlaceholder: 'e.g. CSE',
    formShortCodeHint:
      'Short uppercase code used on badges and for roster Department mapping.',
    formDescription: 'Description',
    formDescriptionPlaceholder: 'Optional overview of the Department…',
    submitCreate: 'Create department',
    submitSave: 'Save changes',
    errNameRequired: 'Enter the Department name.',
    errShortCodeRequired: 'Enter a short code — roster mapping uses it.',
    errCreate:
      "The Department couldn't be created. The server rejected the request — check the details and try again.",
    errUpdate:
      "Department details weren't saved. The server didn't respond — try again in a moment.",
    toastCreated: (name: string) => `${name} created.`,
    toastSaved: (name: string) => `${name} saved.`,
  },

  assignClubs: {
    title: (dept: string) => `Assign clubs to ${dept}`,
    description: 'Pick the Departmental clubs affiliated with this Department.',
    searchPlaceholder: 'Search clubs by name or description',
    loadingLabel: 'Loading clubs',
    selectedCount: (count: number) => (count === 1 ? '1 club selected' : `${count} clubs selected`),
    selectAll: 'Select all',
    clear: 'Clear',
    centralExcluded:
      "Central clubs belong to no Department and can't be assigned here.",
    noMatches: 'No Departmental clubs match your search.',
    save: 'Save assignments',
    errSave:
      "Club assignments weren't saved. The server didn't respond — try again in a moment.",
    toastSaved: (dept: string) => `Club assignments saved for ${dept}.`,
  },

  inviteManager: {
    title: 'Invite an Event Manager',
    titleToClub: 'Invite an Event Manager to this club',
    description:
      'They receive an email invite to set up their Event Manager account.',
    formName: 'Full name',
    formNamePlaceholder: 'e.g. Priya Sharma',
    formEmail: 'Email',
    formEmailPlaceholder: 'e.g. priya@college.edu',
    submit: 'Send invite',
    errFieldsRequired:
      "Enter a name and an email — the invite is sent to the email, so double-check it.",
    errSend:
      "The invite wasn't sent. The server didn't respond — try again in a moment.",
    toastSent:
      'Invite sent. They have 48 hours to accept — follow up if nothing arrives.',
  },

  addExistingManager: {
    title: 'Add an existing account as Event Manager',
    description: 'Assign a registered, active account to manage this club.',
    searchPlaceholder: 'Search active accounts by name or email',
    loadingLabel: 'Loading accounts',
    empty: 'No active accounts are available to assign. Invite a new Event Manager instead.',
    assign: 'Add as Event Manager',
    errSelect: 'Pick an account to add as Event Manager.',
    errAssign:
      "The account wasn't added. The server didn't respond — try again in a moment.",
    toastAssigned: (name: string) => `${name} can now manage this club.`,
  },

  deleteOtp: {
    // Shared strings for the two-step (email code) deletion flow.
    requestingLabel: 'Sending a verification code to your admin email…',
    codeSent: 'A verification code was sent to your admin email address.',
    codeResent: 'A new verification code was sent to your email.',
    codeLabel: 'Verification code',
    codePlaceholder: 'e.g. 123456',
    resendCode: 'Resend code',
    blockedTitle: 'Deletion blocked',
    errRequestCode:
      "The verification code couldn't be sent. Check your connection and try again.",
    errInvalidCode:
      "That code didn't work. Codes expire after a few minutes — request a new one and try again.",
    close: 'Close',
  },

  roster: {
    title: 'Student roster',
    description:
      'Import student records in bulk so they can self-activate with their roll number.',
    loadSample: 'Load sample CSV',
    howTitle: 'How the roster and self-activation work',
    howBody:
      'Imported students are created as inactive accounts — active accounts are never overwritten. Students visit their campus activation page, enter their roll number, and receive a one-time code at their institutional email.',
    uploadTitle: 'Upload a CSV file',
    uploadChoose: 'Click to choose a CSV file',
    uploadHint: 'UTF-8 .csv, up to 5,000 rows per batch.',
    pasteTitle: 'Paste CSV text',
    pastePlaceholder: 'Paste comma-separated rows here…',
    parsedCount: (count: number) =>
      count === 1 ? '1 valid student row' : `${count} valid student rows`,
    clear: 'Clear',
    headersLabel: 'Expected headers',
    validationTitle: 'Fix these before importing',
    duplicates: (rolls: string) =>
      `Duplicate roll numbers in this batch: ${rolls} — later rows update earlier ones.`,
    previewTitle: (count: number) => `Preview (${count} ${count === 1 ? 'student' : 'students'})`,
    import: 'Import roster',
    importing: 'Importing…',
    sumTotal: 'Total rows',
    sumInserted: 'New accounts',
    sumUpdated: 'Updated accounts',
    sumSkipped: 'Kept safe',
    sumSkippedHint: 'Active accounts preserved — never overwritten.',
    tableRoll: 'Roll number',
    tableName: 'Name',
    tableDept: 'Department',
    tableYear: 'Year',
    tableEmail: 'Email',
    noDept: '—',
    toastImported: (inserted: number, updated: number, skipped: number) =>
      `Roster imported: ${inserted} new, ${updated} updated, ${skipped} active accounts kept safe.`,
    errUpload:
      "The roster wasn't imported. The server rejected the file — check the format and try again.",
    errValidation:
      'The CSV needs a header row and at least one student row, with "roll_number" and "name" columns.',
  },

  profile: {
    title: 'My profile',
    loadingLabel: 'Loading your profile',
    changePhoto: 'Change photo',
    removePhoto: 'Remove photo',
    confirmRemoveTitle: 'Remove your profile picture?',
    confirmRemoveBody:
      'Your profile shows your initials until you upload a new picture.',
    toastAvatarUploaded: 'Profile picture updated.',
    toastAvatarRemoved: 'Profile picture removed.',
    generalInfo: 'General information',
    formName: 'Display name',
    formEmail: 'Institutional email',
    formEmailHint: "Bound to your college's identity — it can't be changed.",
    saveProfile: 'Save profile',
    errNameEmpty: 'Enter your name.',
    toastProfileSaved: 'Profile saved.',
    security: 'Password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    newPasswordHint: 'At least 6 characters.',
    updatePassword: 'Update password',
    errCurrentRequired: 'Enter your current password.',
    errNewLength: 'The new password must be at least 6 characters.',
    errMismatch: "The passwords don't match — retype the new password in both fields.",
    toastPasswordSaved: 'Password updated.',
  },

  multiSelect: {
    selectAll: 'Select all',
    clearAll: 'Clear all',
    noMatches: 'No matches for your search.',
  },
} as const;
