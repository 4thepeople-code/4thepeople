'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, ShieldAlert, RefreshCw, Mail, Loader2 } from 'lucide-react';

export interface DeleteOtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestCode: () => Promise<unknown>;
  onConfirm?: (code: string) => Promise<unknown>;
  onConfirmDelete?: (code: string) => Promise<unknown>;
  title?: string;
  itemType?: string;
  itemName?: string;
  warningText?: string;
  confirmText?: string;
  onSuccess?: () => void;
}

export function DeleteOtpModal({
  isOpen,
  onClose,
  onRequestCode,
  onConfirm,
  onConfirmDelete,
  title = 'Confirm Deletion',
  itemName = '',
  warningText = 'This action cannot be undone.',
  confirmText = 'Confirm Delete',
  onSuccess,
}: DeleteOtpModalProps) {
  const [stage, setStage] = useState<'requesting' | 'code' | 'blocked'>('requesting');
  const [code, setCode] = useState('');
  const [blockedError, setBlockedError] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [notice, setNotice] = useState('');
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const onRequestCodeRef = useRef(onRequestCode);
  onRequestCodeRef.current = onRequestCode;

  const onConfirmRef = useRef(onConfirm || onConfirmDelete);
  onConfirmRef.current = onConfirm || onConfirmDelete;

  const hasRequestedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (!hasRequestedRef.current) {
        hasRequestedRef.current = true;
        setCode('');
        setBlockedError('');
        setInlineError('');
        setNotice('');
        setIsRequestingCode(true);

        onRequestCodeRef.current()
          .then(() => {
            setStage('code');
            setNotice('A verification code has been sent to your admin email address.');
          })
          .catch((err: unknown) => {
            const errObj = err as { response?: { status?: number; data?: { message?: string; error?: string } } };
            const message =
              errObj.response?.data?.message ||
              errObj.response?.data?.error ||
              'Unable to request deletion verification code.';

            setBlockedError(message);
            setStage('blocked');
          })
          .finally(() => {
            setIsRequestingCode(false);
          });
      }
    } else {
      hasRequestedRef.current = false;
      setStage('requesting');
      setCode('');
      setBlockedError('');
      setInlineError('');
      setNotice('');
    }
  }, [isOpen]);

  const handleResendCode = async () => {
    setIsRequestingCode(true);
    setInlineError('');
    setNotice('');
    try {
      await onRequestCodeRef.current();
      setNotice('A new verification code has been sent to your email.');
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setInlineError(errObj.response?.data?.message || 'Failed to resend verification code.');
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || isDeleting) return;

    setIsDeleting(true);
    setInlineError('');

    try {
      const confirmFn = onConfirmRef.current;
      if (confirmFn) {
        await confirmFn(code.trim());
      }
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string; error?: string } } };
      const message =
        errObj.response?.data?.message ||
        errObj.response?.data?.error ||
        'Failed to verify deletion code. Please ensure it is correct and not expired.';
      setInlineError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1C1B1F]/50 backdrop-blur-xs transition-opacity"
        onClick={isDeleting || isRequestingCode ? undefined : onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md max-h-[92vh] flex flex-col bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg shadow-lg overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 overflow-y-auto flex-1">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 text-[#8B3A3A] dark:text-rose-400 rounded">
                <AlertTriangle className="w-4 h-4 stroke-[1.75]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif">{title}</h3>
                {itemName && (
                  <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0] truncate max-w-xs">{itemName}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isDeleting || isRequestingCode}
              className="text-[#8E8B85] hover:text-[#1C1B1F] dark:hover:text-[#F5F3EF] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Blocked Stage */}
          {stage === 'blocked' && (
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 rounded text-xs text-[#8B3A3A] dark:text-rose-300 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Deletion Blocked</span>
                </div>
                <p className="leading-relaxed">{blockedError}</p>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Requesting Initial Code Stage */}
          {stage === 'requesting' && (
            <div className="py-8 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-6 h-6 text-[#B08D57] animate-spin" />
              <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0]">
                Generating 2-factor deletion code and dispatching to email...
              </p>
            </div>
          )}

          {/* Verification Code Input Stage */}
          {stage === 'code' && (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {notice && (
                <div className="p-3 bg-[#EBF3ED] dark:bg-emerald-950/40 border border-[#D1E3D7] dark:border-emerald-900/60 rounded text-xs text-[#2E5A44] dark:text-emerald-300 flex items-center gap-2">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              {inlineError && (
                <div className="p-3 bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 rounded text-xs text-[#8B3A3A] dark:text-rose-300">
                  {inlineError}
                </div>
              )}

              <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0] leading-relaxed">
                {warningText} Please enter the 6-digit confirmation code dispatched to your registered administrator address.
              </p>

              <div>
                <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1">
                  Verification Code (OTP)
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. 123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-[#1C1B1F] dark:text-[#F5F3EF] text-sm text-center tracking-widest font-mono placeholder-[#A8A5A0] focus:outline-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isRequestingCode || isDeleting}
                  className="text-xs text-[#B08D57] hover:underline flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isRequestingCode ? 'animate-spin' : ''}`} />
                  Resend Code
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isDeleting || isRequestingCode}
                    className="px-3.5 py-1.5 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isDeleting || !code.trim()}
                    className="px-4 py-1.5 bg-[#8B3A3A] hover:bg-[#722F2F] text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {confirmText}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeleteOtpModal;
