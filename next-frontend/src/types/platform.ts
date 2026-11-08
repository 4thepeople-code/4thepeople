export interface PlatformAdminUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  totpEnrolled: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreatePlatformAdminPayload {
  name: string;
  email: string;
  password: string;
}

export interface UpdatePlatformAdminPayload {
  id: string;
  name?: string;
  isActive?: boolean;
}

export interface ResetPlatformAdminTotpPayload {
  id: string;
}

export interface EnrollTotpPayload {
  verificationCode?: string;
}

export interface EnrollTotpResponse {
  otpauthUrl?: string;
  secret?: string;
  liveCode?: string;
  secondsRemaining?: number;
  totpEnrolled: boolean;
}

export type CollegeAdminStatus = 'NOT_ASSIGNED' | 'PENDING_ACTIVATION' | 'INVITATION_EXPIRED' | 'ACTIVE' | 'SUSPENDED';

export interface CollegeAdminSummary {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  status: CollegeAdminStatus;
  inviteExpiresAt?: string | null;
  createdAt: string;
  emailSent?: boolean;
  emailError?: string | null;
}

export interface PlatformCollege {
  id: string;
  name: string;
  slug: string;
  code: string;
  officialEmail?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  contactNumber?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  admin: CollegeAdminSummary | null;
  adminCount: number;
}

export interface CreateCollegePayload {
  name: string;
  code: string;
  officialEmail?: string;
  address?: string;
  city?: string;
  state?: string;
  contactNumber?: string;
  admin?: {
    name: string;
    email: string;
    contactNumber?: string;
  };
}

export interface UpdateCollegePayload {
  id: string;
  name: string;
  officialEmail?: string;
  address?: string;
  city?: string;
  state?: string;
  contactNumber?: string;
}

export interface ToggleCollegeStatusPayload {
  id: string;
  isActive?: boolean;
}

export interface ProvisionCollegeAdminPayload {
  collegeId: string;
  name: string;
  email: string;
}

export interface ResendCollegeAdminInvitePayload {
  adminId: string;
}

export interface ToggleCollegeAdminStatusPayload {
  adminId: string;
  isActive?: boolean;
}


