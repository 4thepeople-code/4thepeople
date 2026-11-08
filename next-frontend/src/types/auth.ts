import { User, UserRole, PlatformRole } from './models';

export type AnyAuthRole = UserRole | PlatformRole | 'PLATFORM_SUPER_ADMIN' | 'STUDENT' | string;

export interface DecodedToken {
  id?: string;
  userId?: string;
  collegeId?: string;
  email?: string;
  role?: AnyAuthRole;
  type?: 'college' | 'platform';
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

export interface AuthUser extends Omit<Partial<User>, 'role'> {
  id: string;
  userId?: string;
  role: AnyAuthRole;
  email: string;
  name?: string;
  collegeId?: string;
  platformAdminId?: string;
  isPlatformAdmin?: boolean;
}

export interface AuthContextState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (userData: AuthUser | string, tokenOrData?: string | Partial<User> | null) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export interface StudentActivationRequestPayload {
  rollNumber: string;
}

export interface StudentActivationConfirmPayload {
  rollNumber: string;
  code: string;
  password: string;
  email?: string;
}

export interface StudentLoginPayload {
  rollNumber?: string;
  email?: string;
  password: string;
}

export interface StandardLoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  email: string;
  otp: string;
  password: string;
}

export interface PlatformLoginPayload {
  email: string;
  password: string;
  totpCode?: string;
  totp?: string;
  setupSecret?: string;
}

export interface PlatformLoginResponse {
  message?: string;
  admin?: AuthUser;
  token?: string;
  requiresTotp?: boolean;
  requiresTotpSetup?: boolean;
  setup?: {
    secret: string;
    otpauthUrl: string;
    liveCode?: string;
    secondsRemaining?: number;
  };
  totp?: {
    secret: string;
    otpauthUrl: string;
    liveCode?: string;
    secondsRemaining?: number;
  };
}

export interface PlatformSetupStatusResponse {
  isInitialized: boolean;
  count: number;
}

export interface InitialPlatformSetupPayload {
  name: string;
  email: string;
  password: string;
}

