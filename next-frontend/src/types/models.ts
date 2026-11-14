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

export type CertificateSource = 'INDIVIDUAL_UPLOAD' | 'BULK_UPLOAD' | 'GENERATED';
export type CertificateStatus = 'ISSUED' | 'REVOKED';
export type CertificateBatchStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED';

export interface EventCertificate {
  id: string;
  collegeId: string;
  eventId: string;
  userId: string;
  certificateNumber: string;
  certificatePublicId?: string | null;
  certificateUrl?: string | null;
  source: CertificateSource;
  status: CertificateStatus;
  issuedAt: string;
  issuedById?: string | null;
  revokedAt?: string | null;
  revokedById?: string | null;
  revocationReason?: string | null;
  metadata?: Record<string, unknown> | null;
  user?: Partial<User> | null;
  issuedBy?: Partial<User> | null;
  revokedBy?: Partial<User> | null;
  event?: Partial<Event> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlaceholderConfigItem {
  placeholder: string;
  x: number;
  y: number;
  size?: number;
  font?: 'Helvetica' | 'HelveticaBold' | 'Times';
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export interface EventCertificateTemplate {
  id: string;
  collegeId: string;
  eventId: string;
  templateName: string;
  templatePublicId: string;
  templateUrl: string;
  placeholderConfig: PlaceholderConfigItem[];
  isActive: boolean;
  createdAt?: string;
}

export interface CertificateBatch {
  id: string;
  collegeId: string;
  eventId: string;
  method: 'BULK_UPLOAD' | 'GENERATED';
  status: CertificateBatchStatus;
  totalCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  errorDetails?: Array<{ rollNumber?: string; filename?: string; studentName?: string; reason: string }> | null;
  createdAt?: string;
}

export interface EligibleStudentItem {
  registrationId: string;
  registeredAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    rollNumber?: string | null;
    department?: { name: string; shortCode: string } | null;
  };
  certificate?: {
    id: string;
    userId: string;
    certificateNumber: string;
    issuedAt: string;
  } | null;
  hasActiveCertificate: boolean;
}

export interface PublicCertificateVerification {
  valid: boolean;
  status?: CertificateStatus;
  certificateNumber: string;
  recipientName?: string;
  eventTitle?: string;
  collegeName?: string;
  issuedAt?: string;
  isRevoked?: boolean;
  revokedAt?: string | null;
  message?: string;
}


