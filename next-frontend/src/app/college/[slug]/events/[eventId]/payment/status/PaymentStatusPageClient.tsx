'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import PublicLayout from '@/components/public/PublicLayout';
import {
  usePublicEventById,
  useMyRegistrationStatus,
  useExternalRegistrationStatus,
} from '@/lib/api/events';
import {
  studentVerifyPayment,
  externalVerifyPayment,
  getPaymentTransactionStatus,
} from '@/lib/api/payment';
import { getStoredExternalToken } from '@/lib/auth/tokenStorage';
import type { PaymentTransactionStatus } from '@/types/payment';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Ticket,
  Receipt,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

export interface PaymentStatusPageClientProps {
  slug: string;
  eventId: string;
}

export function PaymentStatusPageClient({ slug, eventId }: PaymentStatusPageClientProps) {
  const searchParams = useSearchParams();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const transactionId = searchParams.get('transactionId') || searchParams.get('txn_id') || '';
  const orderId = searchParams.get('order_id') || searchParams.get('cf_order_id') || '';

  const [externalToken, setExternalToken] = useState<string | null>(null);
  useEffect(() => {
    setExternalToken(getStoredExternalToken());
  }, []);

  // Event Data
  const { data: event } = usePublicEventById(eventId);

  // Registration Status Queries
  const {
    data: studentReg,
    refetch: refetchStudentReg,
  } = useMyRegistrationStatus(slug, eventId, Boolean(user));

  const {
    data: externalReg,
    refetch: refetchExternalReg,
  } = useExternalRegistrationStatus(eventId, !user && Boolean(externalToken));

  const isRegistered = Boolean(studentReg?.isRegistered || externalReg?.isRegistered);

  // Polling & Status State
  const [pollCount, setPollCount] = useState<number>(0);
  const [isPolling, setIsPolling] = useState<boolean>(true);
  const [terminalState, setTerminalState] = useState<PaymentTransactionStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Verifying transaction with payment gateway...');

  const MAX_POLLS = 10;

  // Handle gateway redirects (e.g. Cashfree returnUrl redirect with order_id)
  useEffect(() => {
    if (!orderId && !transactionId) return;
    if (isRegistered) {
      setTerminalState('PAID');
      setIsPolling(false);
      return;
    }

    // If orderId is present and not yet registered, attempt client verification with backend
    const verifyGatewayRedirect = async () => {
      try {
        if (user && transactionId) {
          const res = await studentVerifyPayment(eventId, {
            transactionId,
            paymentDetails: { orderId: transactionId, cf_order_id: orderId },
          });
          if (res.success && res.registration) {
            setTerminalState('PAID');
            setIsPolling(false);
            void refetchStudentReg();
          } else if (res.status === 'LATE_PAYMENT') {
            setTerminalState('LATE_PAYMENT');
            setIsPolling(false);
          }
        } else if (externalToken && transactionId) {
          const res = await externalVerifyPayment(
            eventId,
            { transactionId, paymentDetails: { orderId: transactionId, cf_order_id: orderId } },
            externalToken
          );
          if (res.success && res.registration) {
            setTerminalState('PAID');
            setIsPolling(false);
            void refetchExternalReg();
          } else if (res.status === 'LATE_PAYMENT') {
            setTerminalState('LATE_PAYMENT');
            setIsPolling(false);
          }
        }
      } catch (err: unknown) {
        console.warn('Auto-verification of redirect encountered:', err);
      }
    };

    void verifyGatewayRedirect();
  }, [orderId, transactionId, user, externalToken, eventId, isRegistered, refetchStudentReg, refetchExternalReg]);

  // Polling loop with exponential backoff (3s -> 4.5s -> 6.7s...)
  const checkStatus = useCallback(async () => {
    if (isRegistered) {
      setTerminalState('PAID');
      setIsPolling(false);
      return;
    }

    if (pollCount >= MAX_POLLS) {
      setIsPolling(false);
      if (!terminalState) {
        setStatusMessage(
          'Payment processing is taking longer than usual. If funds were debited, your registration will be automatically confirmed via webhook.'
        );
      }
      return;
    }

    // 1. Authoritative transaction status check via dedicated endpoint
    if (transactionId) {
      try {
        const res = await getPaymentTransactionStatus(transactionId, eventId, externalToken);
        if (res.transaction.status === 'PAID' || res.isRegistered) {
          setTerminalState('PAID');
          setIsPolling(false);
          if (user) void refetchStudentReg();
          else if (externalToken) void refetchExternalReg();
          return;
        }
        if (res.transaction.status === 'FAILED') {
          setTerminalState('FAILED');
          setIsPolling(false);
          setStatusMessage(res.transaction.failureReason || 'Payment failed. Please try again.');
          return;
        }
        if (res.transaction.status === 'LATE_PAYMENT') {
          setTerminalState('LATE_PAYMENT');
          setIsPolling(false);
          return;
        }
        if (res.transaction.status === 'REFUNDED' || res.transaction.status === 'PARTIALLY_REFUNDED') {
          setTerminalState(res.transaction.status);
          setIsPolling(false);
          return;
        }
      } catch (err: unknown) {
        console.warn('Transaction status polling encountered error, falling back to registration check:', err);
      }
    }

    // 2. Fallback check on registrations
    if (user) {
      const res = await refetchStudentReg();
      if (res.data?.isRegistered) {
        setTerminalState('PAID');
        setIsPolling(false);
        return;
      }
    } else if (externalToken) {
      const res = await refetchExternalReg();
      if (res.data?.isRegistered) {
        setTerminalState('PAID');
        setIsPolling(false);
        return;
      }
    }

    setPollCount((prev) => prev + 1);
  }, [isRegistered, pollCount, user, externalToken, eventId, transactionId, refetchStudentReg, refetchExternalReg, terminalState]);

  useEffect(() => {
    if (!isPolling || terminalState) return;
    const delay = Math.min(10000, 3000 * Math.pow(1.2, pollCount));
    const timer = setTimeout(() => {
      void checkStatus();
    }, delay);
    return () => clearTimeout(timer);
  }, [checkStatus, isPolling, terminalState, pollCount]);

  // If already registered
  const computedState: PaymentTransactionStatus =
    isRegistered || terminalState === 'PAID'
      ? 'PAID'
      : terminalState || 'PENDING';

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-20 space-y-8">
        {/* Breadcrumb Navigation */}
        <Link
          href={`/college/${slug}/events/${eventId}`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Event Details</span>
        </Link>

        {/* Main Status Container */}
        <div
          className={`rounded-3xl border p-6 sm:p-8 shadow-xl transition-all ${
            isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200 shadow-slate-200/50'
          }`}
        >
          {/* Status 1: PAID (Success) */}
          {computedState === 'PAID' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Payment Confirmed & Verified</span>
                </div>
                <h1
                  className={`font-['Syne',sans-serif] text-2xl sm:text-3xl font-extrabold uppercase tracking-tight ${
                    isDark ? 'text-white' : 'text-[#0F172A]'
                  }`}
                >
                  Registration Secured!
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-300 max-w-md mx-auto">
                  Your payment has been cryptographically verified by the bank gateway. Your seat is confirmed for this event.
                </p>
              </div>

              {/* Receipt Summary Card */}
              <div
                className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${
                  isDark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                  <span className="text-xs text-slate-500">Event</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-xs">
                    {event?.title || 'Campus Event'}
                  </span>
                </div>

                {transactionId && (
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10 font-mono text-[11px]">
                    <span className="text-slate-500">Transaction Ref</span>
                    <span className="text-purple-600 dark:text-purple-400">{transactionId}</span>
                  </div>
                )}

                {event?.fee ? (
                  <div className="flex items-center justify-between font-bold text-xs">
                    <span className="text-slate-500">Amount Paid</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ₹{event.fee} {event.currency || 'INR'}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                {user ? (
                  <Link
                    href={`/college/${slug}/student?tab=registrations`}
                    className="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-[#00F0FF] hover:bg-[#38f2ff] text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20"
                  >
                    <Ticket className="w-4 h-4" />
                    <span>View My Registrations</span>
                  </Link>
                ) : (
                  <Link
                    href={`/college/${slug}/events/${eventId}`}
                    className="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-[#00F0FF] hover:bg-[#38f2ff] text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-cyan-500/20"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Return to Event Page</span>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Status 2: PENDING (Processing) */}
          {computedState === 'PENDING' && (
            <div className="space-y-6 text-center animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[#00F0FF] flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-[#00F0FF] text-xs font-bold uppercase tracking-wider">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Awaiting Authoritative Gateway Confirmation</span>
                </div>
                <h1
                  className={`font-['Syne',sans-serif] text-2xl sm:text-3xl font-extrabold uppercase tracking-tight ${
                    isDark ? 'text-white' : 'text-[#0F172A]'
                  }`}
                >
                  Processing Payment...
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
                  {statusMessage}
                </p>
              </div>

              {/* Progress Polling Info */}
              <div
                className={`p-4 rounded-2xl border text-xs text-left space-y-2 ${
                  isDark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Verification polling</span>
                  <span>
                    Attempt {pollCount} of {MAX_POLLS}
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#00F0FF] h-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (pollCount / MAX_POLLS) * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Please do not close or navigate away from this tab while we finalize bank capture and seat confirmation.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPollCount(0);
                    setIsPolling(true);
                    void checkStatus();
                  }}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Status Now</span>
                </button>
              </div>
            </div>
          )}

          {/* Status 3: LATE_PAYMENT */}
          {computedState === 'LATE_PAYMENT' && (
            <div className="space-y-6 text-center animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
                  <span>Seat Hold Expired Prior to Payment</span>
                </div>
                <h1
                  className={`font-['Syne',sans-serif] text-2xl sm:text-3xl font-extrabold uppercase tracking-tight ${
                    isDark ? 'text-white' : 'text-[#0F172A]'
                  }`}
                >
                  Late Payment Received
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
                  Your payment was received after the 15-minute seat reservation window expired. To prevent overbooking,
                  your registration was not confirmed and an automatic full refund has been scheduled.
                </p>
              </div>

              <div
                className={`p-4 rounded-2xl border text-xs text-left space-y-2 font-mono text-[11px] ${
                  isDark ? 'bg-amber-950/20 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                <div>Status: LATE_PAYMENT (Refund Queued)</div>
                {transactionId && <div>Transaction Ref: {transactionId}</div>}
                <div className="font-sans text-[11px] mt-1 text-slate-400">
                  Refunds typically reflect in your bank account or original payment instrument within 5–7 business days.
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <Link
                  href={`/college/${slug}/events/${eventId}`}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Registration</span>
                </Link>
              </div>
            </div>
          )}

          {/* Status 4: FAILED */}
          {computedState === 'FAILED' && (
            <div className="space-y-6 text-center animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">
                  <span>Transaction Rejected or Aborted</span>
                </div>
                <h1
                  className={`font-['Syne',sans-serif] text-2xl sm:text-3xl font-extrabold uppercase tracking-tight ${
                    isDark ? 'text-white' : 'text-[#0F172A]'
                  }`}
                >
                  Payment Failed
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
                  The payment transaction could not be completed. Your card/account was not billed or any pending hold will automatically reverse.
                </p>
              </div>

              {transactionId && (
                <div
                  className={`p-3 rounded-xl border font-mono text-[11px] text-slate-500 text-center ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  Transaction Reference: {transactionId}
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-2">
                <Link
                  href={`/college/${slug}/events/${eventId}`}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </Link>
              </div>
            </div>
          )}

          {/* Status 5: REFUNDED / REFUND_PENDING */}
          {(computedState === 'REFUNDED' || computedState === 'PARTIALLY_REFUNDED' || computedState === 'REFUND_PENDING') && (
            <div className="space-y-6 text-center animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-500 flex items-center justify-center mx-auto">
                <Receipt className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
                  <span>Refund {computedState === 'REFUNDED' ? 'Completed' : 'In Progress'}</span>
                </div>
                <h1
                  className={`font-['Syne',sans-serif] text-2xl sm:text-3xl font-extrabold uppercase tracking-tight ${
                    isDark ? 'text-white' : 'text-[#0F172A]'
                  }`}
                >
                  {computedState === 'REFUNDED' ? 'Full Refund Processed' : 'Refund Initiated'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
                  A refund has been issued for this event registration through the gateway.
                </p>
              </div>

              {transactionId && (
                <div
                  className={`p-3 rounded-xl border font-mono text-[11px] text-slate-500 text-center ${
                    isDark ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  Transaction Reference: {transactionId}
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-2">
                <Link
                  href={`/college/${slug}/events/${eventId}`}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold transition flex items-center gap-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Event</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
