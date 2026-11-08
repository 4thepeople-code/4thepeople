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

