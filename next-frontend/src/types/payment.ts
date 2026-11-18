/**
 * Payment domain types and API contract definitions for 4thepeople.
 * Strictly aligned with backend Prisma models, controllers, and security policies.
 */

export type PaymentGatewayProvider = 'RAZORPAY' | 'CASHFREE';
export type CollegePaymentMode = 'COLLEGE_OWNED_GATEWAY' | 'PLATFORM_MANAGED_GATEWAY';
export type PaymentConfigStatus = 'NOT_CONFIGURED' | 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED';

export type PaymentTransactionStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'LATE_PAYMENT'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type PaymentRefundStatus = 'INITIATED' | 'PROCESSED' | 'FAILED';

/**
 * Sanitized college payment configuration returned to Super-Admin.
 * Never includes raw ciphertext or plaintext secrets.
 */
export interface CollegePaymentConfigSummary {
  configured: boolean;
  id?: string;
  collegeId: string;
  provider: PaymentGatewayProvider;
  mode: CollegePaymentMode;
  status: PaymentConfigStatus;
  isTestMode: boolean;
  displayMerchantName: string | null;
  credentialsRotatedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  hasKeyId: boolean;
  keyIdPreview: string | null;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  hasMerchantAccountId: boolean;
}

/**
 * Super Admin payload for updating gateway credentials or status.
 */
export interface UpdatePaymentConfigPayload {
  collegeId: string;
  provider?: PaymentGatewayProvider;
  mode?: CollegePaymentMode;
  status?: PaymentConfigStatus;
  isTestMode?: boolean;
  displayMerchantName?: string | null;
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
  merchantAccountId?: string;
  changeReason?: string;
}

/**
 * Audit log entry for payment configuration and credential rotation.
 */
export interface PaymentConfigAuditEntry {
  id: string;
  collegeId: string;
  changedByAdminId: string | null;
  previousStatus: string | null;
  newStatus: string;
  previousMode: string | null;
  newMode: string;
  previousProvider: string | null;
  newProvider: string;
  previousIsTestMode: boolean | null;
  newIsTestMode: boolean;
  credentialsRotated: boolean;
  keyIdPreview: string | null;
  changeReason: string | null;
  ipAddress: string | null;
  createdAt: string;
}

/**
 * Result returned from test-connection endpoint.
 */
export interface TestPaymentConnectionResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

/**
 * Checkout session payload returned by backend POST /events/:eventId/checkout
 */
export interface CheckoutSessionData {
  reused: boolean;
  transactionId: string;
  reservationId: string;
  reservationExpiresAt: string;
  amount: number;
  currency: string;
  provider: PaymentGatewayProvider;
  gatewayOrderId: string;
  paymentSessionId?: string | null; // Cashfree drop-in session id
  keyId?: string; // Razorpay public key_id
  isTestMode: boolean;
  displayMerchantName: string;
}

/**
 * Payment verification request body sent to backend POST /events/:eventId/verify-payment
 */
export interface VerifyPaymentPayload {
  transactionId: string;
  paymentDetails: Record<string, unknown>;
}

/**
 * Authoritative verification result returned by backend verify-payment
 */
export interface PaymentVerificationResult {
  success: boolean;
  idempotent?: boolean;
  status?: string;
  warning?: string;
  message: string;
  transactionId?: string;
  registration?: {
    id: string;
    eventId: string;
    registeredAt: string;
  } | null;
}

/**
 * Financial ledger transaction summary
 */
export interface PaymentTransactionSummary {
  id: string;
  collegeId: string;
  eventId: string;
  amount: number;
  currency: string;
  status: PaymentTransactionStatus;
  gatewayProvider: PaymentGatewayProvider;
  paymentMode: CollegePaymentMode;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  paymentMethod?: string | null;
  vpaMasked?: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Authoritative payment transaction status response
 */
export interface PaymentTransactionStatusResult {
  transaction: PaymentTransactionSummary;
  isRegistered: boolean;
  registration: {
    id: string;
    eventId: string;
    status: string;
    registeredAt: string;
  } | null;
}

/**
 * College payment gateway readiness summary
 */
export interface CollegeGatewayReadiness {
  collegeId: string;
  configured: boolean;
  status: PaymentConfigStatus;
  provider: PaymentGatewayProvider;
  mode: CollegePaymentMode;
  isTestMode: boolean;
  displayMerchantName: string | null;
  isReady: boolean;
}
