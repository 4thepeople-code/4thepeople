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
  retry: 'Try again',
  logOut: 'Log out',
  goToLogin: 'Go to login',
  backToDashboard: 'Back to dashboard',
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
} as const;
