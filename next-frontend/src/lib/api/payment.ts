import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './axios';
import { queryKeys } from './queryKeys';
import { getStoredExternalToken } from '../auth/tokenStorage';
import type {
  CheckoutSessionData,
  VerifyPaymentPayload,
  PaymentVerificationResult,
  PaymentTransactionStatusResult,
  CollegeGatewayReadiness,
} from '@/types/payment';
import type { ApiResponse } from '@/types/api';

/**
 * Initiates checkout session for an authenticated student (same or cross-college).
 * Calls POST /api/events/:eventId/checkout
 */
export async function studentCheckout(
  eventId: string,
  options?: {
    formAnswers?: Record<string, unknown>;
    returnUrl?: string;
  }
): Promise<CheckoutSessionData> {
  const response = await apiClient.post<ApiResponse<CheckoutSessionData>>(
    `/events/${eventId}/checkout`,
    options || {}
  );
  if (!response.data.data) {
    throw new Error(response.data.message || 'Failed to create checkout session');
  }
  return response.data.data;
}

/**
 * Mutation hook for student payment checkout.
 */
export function useStudentCheckoutMutation() {
  return useMutation({
    mutationFn: ({
      eventId,
      formAnswers,
      returnUrl,
    }: {
      eventId: string;
      formAnswers?: Record<string, unknown>;
      returnUrl?: string;
    }) => studentCheckout(eventId, { formAnswers, returnUrl }),
  });
}

/**
 * Verifies client-side payment completion for an authenticated student.
 * Calls POST /api/events/:eventId/verify-payment
 */
export async function studentVerifyPayment(
  eventId: string,
  payload: VerifyPaymentPayload
): Promise<PaymentVerificationResult> {
  const response = await apiClient.post<ApiResponse<PaymentVerificationResult>>(
    `/events/${eventId}/verify-payment`,
    payload
  );
  return response.data.data || { success: true, message: response.data.message || 'Payment verified' };
}

/**
 * Mutation hook for student payment verification.
 */
export function useStudentVerifyPaymentMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      payload,
    }: {
      eventId: string;
      payload: VerifyPaymentPayload;
    }) => studentVerifyPayment(eventId, payload),
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).registrations.status(eventId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).registrations.myRegistrations(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).events.all,
      });
    },
  });
}

/**
 * Initiates checkout session for an external guest using verified external JWT.
 * Calls POST /api/external/events/:eventId/checkout
 */
export async function externalCheckout(
  eventId: string,
  input: {
    externalParticipantId?: string;
    name: string;
    phone?: string;
    institutionName?: string;
    formAnswers?: Record<string, unknown>;
    returnUrl?: string;
  },
  externalToken?: string
): Promise<CheckoutSessionData> {
  const token = externalToken || getStoredExternalToken();
  if (!token) {
    throw new Error('Verification required: please verify your email before checkout.');
  }

  const response = await apiClient.post<ApiResponse<CheckoutSessionData>>(
    `/external/events/${eventId}/checkout`,
    input,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.data.data) {
    throw new Error(response.data.message || 'Failed to create external checkout session');
  }
  return response.data.data;
}

/**
 * Mutation hook for external participant payment checkout.
 */
export function useExternalCheckoutMutation() {
  return useMutation({
    mutationFn: ({
      eventId,
      input,
      token,
    }: {
      eventId: string;
      input: {
        externalParticipantId?: string;
        name: string;
        phone?: string;
        formAnswers?: Record<string, unknown>;
        returnUrl?: string;
      };
      token?: string;
    }) => externalCheckout(eventId, input, token),
  });
}

/**
 * Verifies payment for an external guest using verified external JWT.
 * Calls POST /api/external/events/:eventId/verify-payment
 */
export async function externalVerifyPayment(
  eventId: string,
  payload: VerifyPaymentPayload,
  externalToken?: string
): Promise<PaymentVerificationResult> {
  const token = externalToken || getStoredExternalToken();
  if (!token) {
    throw new Error('Verification required: external session has expired.');
  }

  const response = await apiClient.post<ApiResponse<PaymentVerificationResult>>(
    `/external/events/${eventId}/verify-payment`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data.data || { success: true, message: response.data.message || 'Payment verified' };
}

/**
 * Mutation hook for external payment verification.
 */
export function useExternalVerifyPaymentMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      payload,
      token,
    }: {
      eventId: string;
      payload: VerifyPaymentPayload;
      token?: string;
    }) => externalVerifyPayment(eventId, payload, token),
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.external.registrationStatus(eventId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).events.all,
      });
    },
  });
}

/**
 * College Admin refund endpoint.
 * Calls POST /api/admin/payments/transactions/:transactionId/refund
 */
export async function adminRefund(
  transactionId: string,
  payload: { amount?: number; reason?: string }
): Promise<unknown> {
  const response = await apiClient.post<ApiResponse<unknown>>(
    `/admin/payments/transactions/${transactionId}/refund`,
    payload
  );
  return response.data;
}

/**
 * Mutation hook for College Admin payment refund.
 */
export function useAdminRefundMutation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      transactionId,
      amount,
      reason,
    }: {
      transactionId: string;
      amount?: number;
      reason?: string;
    }) => adminRefund(transactionId, { amount, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(slug).manager.all,
      });
    },
  });
}

/**
 * Fetches authoritative transaction and registration status.
 * Calls GET /api/payments/transactions/:transactionId
 */
export async function getPaymentTransactionStatus(
  transactionId: string,
  eventId?: string,
  externalToken?: string | null
): Promise<PaymentTransactionStatusResult> {
  const headers: Record<string, string> = {};
  if (externalToken) {
    headers['Authorization'] = `Bearer ${externalToken}`;
  }
  const endpoint = `/payments/transactions/${transactionId}`;
  const response = await apiClient.get<ApiResponse<PaymentTransactionStatusResult>>(
    endpoint,
    { headers }
  );
  if (!response.data.data) {
    throw new Error(response.data.message || 'Failed to fetch payment transaction status');
  }
  return response.data.data;
}

/**
 * Hook to poll or query payment transaction status.
 */
export function usePaymentTransactionStatusQuery(
  slug: string,
  transactionId: string,
  externalToken?: string | null,
  options?: { enabled?: boolean; refetchInterval?: number | false }
) {
  return useQuery({
    queryKey: externalToken
      ? queryKeys.external.paymentStatus(transactionId)
      : queryKeys.tenant(slug).payments.transactionStatus(transactionId),
    queryFn: () => getPaymentTransactionStatus(transactionId, undefined, externalToken),
    enabled: Boolean(transactionId) && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval ?? false,
  });
}

/**
 * Fetches read-only college gateway readiness summary.
 * Calls GET /api/payments/readiness
 */
export async function getCollegeGatewayReadiness(): Promise<CollegeGatewayReadiness> {
  const response = await apiClient.get<ApiResponse<CollegeGatewayReadiness>>(
    '/payments/readiness'
  );
  if (!response.data.data) {
    throw new Error(response.data.message || 'Failed to fetch gateway readiness');
  }
  return response.data.data;
}

/**
 * Hook for managers / admins to inspect if college has an active, usable gateway.
 */
export function useCollegeGatewayReadinessQuery(slug: string) {
  return useQuery({
    queryKey: queryKeys.tenant(slug).payments.gatewayReadiness(),
    queryFn: getCollegeGatewayReadiness,
    staleTime: 60 * 1000,
  });
}
