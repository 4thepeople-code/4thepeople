'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Mail, RefreshCw, ShieldAlert } from 'lucide-react';
import Modal from '@/components/dashboard/ui/Modal';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Field, { Input } from '@/components/dashboard/ui/Field';
import { actions, collegeAdmin } from '@/lib/copy';

export interface DeleteOtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Requests the single-use deletion code (sends it to the admin email). */
  onRequestCode: () => Promise<unknown>;
  /** Verifies the code and performs the deletion. */
  onConfirm: (code: string) => Promise<unknown>;
  /** Dialog title naming the object, e.g. "Delete IEEE Student Branch?" */
  title: string;
  /** The account/club being deleted, shown under the title. */
  itemName?: string;
  /** Names the consequence — required by the confirmation copy rules. */
  warningText: string;
  confirmText: string;
  onSuccess?: () => void;
}

type Stage = 'requesting' | 'code' | 'blocked';

/**
 * Two-step (email code) deletion for users and clubs — the irreversible
 * actions. The code is requested automatically when the dialog opens;
 * failure to send shows the server's reason in a "blocked" stage. Same
 * flow as before; presentation only.
 */
export default function DeleteOtpModal({
  isOpen,
  onClose,
  onRequestCode,
  onConfirm,
  title,
  itemName = '',
  warningText,
  confirmText,
  onSuccess,
}: DeleteOtpModalProps) {
  const t = collegeAdmin.deleteOtp;
  const [stage, setStage] = useState<Stage>('requesting');
  const [code, setCode] = useState('');
  const [blockedError, setBlockedError] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const onRequestCodeRef = useRef(onRequestCode);
  const onConfirmRef = useRef(onConfirm);
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    onRequestCodeRef.current = onRequestCode;
    onConfirmRef.current = onConfirm;
  }, [onRequestCode, onConfirm]);

  useEffect(() => {
    if (isOpen) {
      if (!hasRequestedRef.current) {
        hasRequestedRef.current = true;
        setCode('');
        setBlockedError('');
        setInlineError(null);
        setNotice(null);
        setIsRequestingCode(true);
        onRequestCodeRef.current()
          .then(() => {
            setStage('code');
            setNotice(t.codeSent);
          })
          .catch((err: unknown) => {
            const errObj = err as {
              response?: { status?: number; data?: { message?: string; error?: string } };
            };
            setBlockedError(
              errObj.response?.data?.message ||
                errObj.response?.data?.error ||
                t.errRequestCode,
            );
            setStage('blocked');
          })
          .finally(() => setIsRequestingCode(false));
      }
    } else {
      hasRequestedRef.current = false;
      setStage('requesting');
      setCode('');
      setBlockedError('');
      setInlineError(null);
      setNotice(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const isBusy = isRequestingCode || isDeleting;

  const handleClose = () => {
    if (isBusy) return;
    onClose();
  };

  const handleResendCode = async () => {
    setIsRequestingCode(true);
    setInlineError(null);
    setNotice(null);
    try {
      await onRequestCodeRef.current();
      setNotice(t.codeResent);
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setInlineError(serverMessage || t.errRequestCode);
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim() || isDeleting) return;

    setIsDeleting(true);
    setInlineError(null);

    try {
      await onConfirmRef.current(code.trim());
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string; error?: string } } };
      setInlineError(
        errObj.response?.data?.message ||
          errObj.response?.data?.error ||
          t.errInvalidCode,
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={handleClose} title={title} size="sm">
      {/* Blocked: the backend refused to send a code — show why and stop. */}
      {stage === 'blocked' && (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-2xl border border-[var(--line)] bg-[var(--secondary-soft)]/30 p-4">
            <ShieldAlert aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--secondary)]" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--secondary)]">
                {t.blockedTitle}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">{blockedError}</p>
            </div>
          </div>
          <div className="flex justify-end">
            <DashboardButton variant="secondary" size="sm" onClick={onClose}>
              {t.close}
            </DashboardButton>
          </div>
        </div>
      )}

      {/* Waiting for the first code to arrive */}
      {stage === 'requesting' && (
        <div className="flex flex-col items-center gap-3 py-8" role="status" aria-label={t.requestingLabel}>
          <span
            aria-hidden="true"
            className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--primary)] motion-reduce:animate-none"
          />
          <p className="text-xs text-[var(--ink-soft)]">{t.requestingLabel}</p>
        </div>
      )}

      {/* Enter the code */}
      {stage === 'code' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
            <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--secondary)]" />
            <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
              <span className="font-semibold text-[var(--ink)]">{itemName}</span>
              <br />
              {warningText}
            </p>
          </div>

          {notice && (
            <p className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2.5 text-xs text-[var(--ink-soft)]">
              <Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--primary)]" />
              {notice}
            </p>
          )}

          {inlineError && (
            <p
              role="alert"
              className="rounded-xl bg-[var(--secondary-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--secondary)]"
            >
              {inlineError}
            </p>
          )}

          <Field label={t.codeLabel} htmlFor="delete-otp-code" required>
            <Input
              id="delete-otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t.codePlaceholder}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isBusy}
              className="text-center font-mono tracking-widest"
            />
          </Field>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
            <button
              type="button"
              onClick={() => void handleResendCode()}
              disabled={isBusy}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--primary)] underline-offset-2 transition-colors hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:opacity-50 motion-reduce:transition-none"
            >
              <RefreshCw
                aria-hidden="true"
                className={`h-3 w-3 ${isRequestingCode ? 'animate-spin motion-reduce:animate-none' : ''}`}
              />
              {t.resendCode}
            </button>
            <div className="flex items-center gap-3">
              <DashboardButton variant="secondary" size="sm" onClick={handleClose} disabled={isBusy}>
                {actions.cancel}
              </DashboardButton>
              <DashboardButton
                type="submit"
                variant="danger"
                size="sm"
                loading={isDeleting}
                loadingLabel={confirmText}
                disabled={!code.trim() && !isDeleting}
              >
                {confirmText}
              </DashboardButton>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
