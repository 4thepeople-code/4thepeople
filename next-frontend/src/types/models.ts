/**
 * Domain models matching the Prisma schema and Express backend serializers.
 */

export type UserRole = 'USER' | 'COLLEGE_ADMIN' | 'MANAGER' | 'ADMIN';
export type PlatformRole = 'SUPER_ADMIN' | 'PLATFORM_ADMIN';
export type ClubType = 'DEPARTMENTAL' | 'CENTRAL';
export type EventStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type EventRegistrationMode = 'INTERNAL' | 'EXTERNAL' | 'NONE';
export type FormFieldType = 'TEXT' | 'NUMBER' | 'TEXTAREA' | 'SELECT' | 'RADIO' | 'CHECKBOX';

export interface UserAvatar {
  url: string | null;
  publicId: string | null;
}

export interface College {
  id: string;
  name: string;
  slug: string;
  allowedEmailDomains?: string[];
  studentEmailFormat?: string | null;
  enforceInstitutionalEmail?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Department {
  id: string;
  collegeId?: string;
  name: string;
  shortCode?: string;
  code?: string;
  description?: string | null;
  clubCount?: number;
  clubs?: Club[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Club {
  id: string;
  collegeId?: string;
  name: string;
  code?: string;
  description?: string | null;
  clubType?: ClubType;
  isCentral?: boolean;
  category?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  coverImageUrl?: string | null;
  bannerUrl?: string | null;
  logoPublicId?: string | null;
  coverImagePublicId?: string | null;
  logo?: { url?: string | null; publicId?: string | null } | null;
  coverImage?: { url?: string | null; publicId?: string | null } | null;
  memberCount?: number;
  membersCount?: number;
  members?: Array<{ id: string; user?: Partial<User>; role?: string; joinedAt?: string }>;
  events?: Event[];
  _count?: { members?: number; events?: number };
  createdAt?: string;
  updatedAt?: string;
  departments?: Department[];
}

export interface Membership {
  id: string;
  collegeId: string;
  userId: string;
  clubId: string;
  role: 'MEMBER' | 'MANAGER' | 'ADMIN';
  createdAt?: string;
  club?: Club;
}

export interface User {
  id: string;
  collegeId: string;
  name: string;
  email: string;
  role: UserRole;
  rollNumber?: string | null;
  departmentId?: string | null;
  admissionYear?: number | null;
  isActive: boolean;
  claimedAt?: string | null;
  avatar?: UserAvatar | null;
  createdAt?: string;
  updatedAt?: string;
  memberships?: Membership[];
  department?: Department | null;
}

export interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  isMfaEnabled?: boolean;
  createdAt?: string;
}

export interface CustomFormField {
  id: string;
  name?: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[]; // for SELECT, RADIO, CHECKBOX
}

export interface CustomFormDefinition {
  fields: CustomFormField[];
}

export interface Event {
  id: string;
  collegeId?: string;
  clubId?: string;
  title: string;
  description: string;
  venue?: string | null;
  location?: string | null;
  category?: string | null;
  startAt?: string;
  endAt?: string;
  startDate?: string;
  endDate?: string;
  date?: string;
  status?: EventStatus;
  registrationMode?: EventRegistrationMode;
  registrationUrl?: string | null;
  url?: string | null;
  formUrl?: string | null;
  link?: string | null;
  externalUrl?: string | null;
  registrationDeadline?: string | null;
  capacity?: number | null;
  registeredCount?: number;
  isPaid?: boolean;
  ticketPrice?: number | string | null;
  customFormDefinition?: CustomFormDefinition | null;
  coverImageUrl?: string | null;
  coverUrl?: string | null;
  bannerUrl?: string | null;
  coverImage?: { url?: string | null; publicId?: string | null } | null;
  gallery?: Array<{ url: string; publicId?: string }>;
  createdAt?: string;
  updatedAt?: string;
  club?: Club;
}

export interface EventRegistration {
  id: string;
  collegeId: string;
  eventId: string;
  userId: string;
  formAnswers?: Record<string, unknown> | null;
  registeredAt: string;
  user?: User;
  event?: Event;
}

