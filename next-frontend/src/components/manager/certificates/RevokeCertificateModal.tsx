'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { useRevokeCertificateMutation } from '@/lib/api/manager';
import { AlertTriangle, AlertCircle, Loader2, Ban } from 'lucide-react';
import type { EventCertificate } from '@/types/models';

interface RevokeCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  eventId: string;
  certificate: EventCertificate | null;
  onSuccess?: () => void;
}

export function RevokeCertificateModal({
  isOpen,
  onClose,
  slug,
  eventId,
  certificate,
  onSuccess,
}: RevokeCertificateModalProps) {
  const revokeMutation = useRevokeCertificateMutation(slug, eventId);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!certificate) return;

    if (!reason.trim() || reason.trim().length < 3) {
      setFormError('Please provide a valid revocation reason (at least 3 characters).');
      return;
    }

    try {
      await revokeMutation.mutateAsync({
        certificateId: certificate.id,
        reason: reason.trim(),
      });
      setReason('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error).message ||
        'Failed to revoke certificate';
      setFormError(msg);
    }
  };

  if (!certificate) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !revokeMutation.isPending && onClose()}
      title="Revoke Certificate"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-2.5 text-rose-300 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Warning:</span> Revoking certificate{' '}
            <strong className="text-amber-200">{certificate.certificateNumber}</strong> for student{' '}
            <strong className="text-amber-200">{certificate.user?.name || 'Student'}</strong> will prevent the
            student from viewing or downloading it.
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Reason for Revocation <span className="text-rose-400">*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Student cancelled registration, incorrect details on certificate, or administrative invalidation..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-white/10 bg-black/30 text-white placeholder-slate-500 outline-none focus:border-rose-500 transition resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            disabled={revokeMutation.isPending}
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={revokeMutation.isPending || !reason.trim() || reason.trim().length < 3}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
          >
            {revokeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Revoking...</span>
              </>
            ) : (
              <>
                <Ban className="w-4 h-4" />
                <span>Revoke Certificate</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
