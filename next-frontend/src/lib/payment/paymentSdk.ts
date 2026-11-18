/**
 * Payment SDK Loader & Client Gateway Launcher
 *
 * Dynamically loads official provider client-side SDKs (Razorpay Checkout and Cashfree JS v3)
 * without bundling unverified third-party libraries.
 *
 * Security:
 * - Never stores gateway credentials or secrets client-side.
 * - Always delegates authoritative payment verification and state transitions to the Express backend.
 */

import type { CheckoutSessionData, VerifyPaymentPayload } from '@/types/payment';

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
    Cashfree?: (options: { mode: 'sandbox' | 'production' }) => CashfreeInstance;
  }
}

interface RazorpayOptions {
  key?: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  image?: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    backdropclose?: boolean;
  };
  handler?: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, callback: (response: unknown) => void) => void;
  close: () => void;
}

interface CashfreeInstance {
  checkout: (options: {
    paymentSessionId: string;
    redirectTarget?: '_self' | '_blank' | '_modal';
  }) => Promise<{
    error?: { message: string; code?: string };
    paymentDetails?: { paymentMessage?: string };
    redirect?: boolean;
  }>;
}

/**
 * Loads a remote script dynamically if not already present in the DOM.
 */
function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error(`Failed to load payment SDK script from ${src}`);
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Loads Razorpay Standard Checkout SDK
 */
export async function loadRazorpaySdk(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.Razorpay) return true;
  return await loadScript('https://checkout.razorpay.com/v1/checkout.js');
}

/**
 * Loads Cashfree JS SDK v3
 */
export async function loadCashfreeSdk(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.Cashfree) return true;
  return await loadScript('https://sdk.cashfree.com/js/v3/cashfree.js');
}

export interface LaunchPaymentParams {
  session: CheckoutSessionData;
  participant: {
    name?: string | null;
    email: string;
    phone?: string | null;
  };
  onSuccess: (verifyPayload: VerifyPaymentPayload) => Promise<void>;
  onFailure: (error: { message: string; details?: unknown }) => void;
  onDismiss?: () => void;
}

/**
 * Launches the appropriate payment gateway checkout modal based on backend session data.
 */
export async function launchPaymentCheckout({
  session,
  participant,
  onSuccess,
  onFailure,
  onDismiss,
}: LaunchPaymentParams): Promise<void> {
  if (session.provider === 'RAZORPAY') {
    const loaded = await loadRazorpaySdk();
    if (!loaded || !window.Razorpay) {
      onFailure({ message: 'Failed to load Razorpay payment gateway. Please check your network connection and try again.' });
      return;
    }

    if (!session.keyId) {
      onFailure({ message: 'Razorpay Key ID missing from checkout session.' });
      return;
    }

    const options: RazorpayOptions = {
      key: session.keyId,
      amount: Math.round(session.amount * 100), // paise
      currency: session.currency || 'INR',
      name: session.displayMerchantName || '4 THE PEOPLE',
      description: `Registration Fee: ₹${session.amount}`,
      order_id: session.gatewayOrderId,
      prefill: {
        name: participant.name || undefined,
        email: participant.email,
        contact: participant.phone || undefined,
      },
      theme: {
        color: '#00F0FF',
      },
      modal: {
        ondismiss: () => {
          if (onDismiss) onDismiss();
        },
      },
      handler: async (response) => {
        try {
          await onSuccess({
            transactionId: session.transactionId,
            paymentDetails: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            },
          });
        } catch (err: unknown) {
          const msg =
            (err as { message?: string })?.message ||
            'Payment verification failed. Please contact event support.';
          onFailure({ message: msg, details: err });
        }
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (errResponse: unknown) => {
      const err = errResponse as { error?: { description?: string; reason?: string } };
      onFailure({
        message: err.error?.description || err.error?.reason || 'Payment failed at the gateway.',
        details: errResponse,
      });
    });
    rzp.open();
  } else if (session.provider === 'CASHFREE') {
    const loaded = await loadCashfreeSdk();
    if (!loaded || !window.Cashfree) {
      onFailure({ message: 'Failed to load Cashfree payment gateway. Please check your network connection and try again.' });
      return;
    }

    if (!session.paymentSessionId) {
      onFailure({ message: 'Cashfree payment session ID missing from checkout session.' });
      return;
    }

    const cashfree = window.Cashfree({
      mode: session.isTestMode ? 'sandbox' : 'production',
    });

    try {
      const result = await cashfree.checkout({
        paymentSessionId: session.paymentSessionId,
        redirectTarget: '_modal',
      });

      if (result.error) {
        onFailure({
          message: result.error.message || 'Cashfree payment failed.',
          details: result.error,
        });
        return;
      }

      if (result.paymentDetails) {
        await onSuccess({
          transactionId: session.transactionId,
          paymentDetails: {
            cf_payment_id: result.paymentDetails.paymentMessage || session.gatewayOrderId,
          },
        });
      } else if (result.redirect) {
        // Cashfree handled modal redirection
      } else {
        if (onDismiss) onDismiss();
      }
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        'Cashfree checkout encountered an unexpected error.';
      onFailure({ message: msg, details: err });
    }
  } else {
    onFailure({ message: `Unsupported payment provider: ${session.provider}` });
  }
}
