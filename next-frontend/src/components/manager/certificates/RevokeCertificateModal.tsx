'use client';

import React, { useState } from 'react';
import Modal from '@/components/dashboard/ui/Modal';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import { actions, managerCertificates } from '@/lib/copy';
import { useRevokeCertificateMutation } from '@/lib/api/manager';
import { AlertTriangle, AlertCircle, Ban } from 'lucide-react';
import type { EventCertificate } from '@/types/models';

interface RevokeCertificateModalProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  eventId: string;
  certificate: EventCertificate | null;
  onSuccess?: () => void;
}

const t = managerCertificates.revoke;

export function RevokeCertificateModal({
  open,
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
      setFormError(t.errReason);
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
        t.errSubmit;
      setFormError(msg);
    }
  };

  if (!certificate) return null;

  return (
    <Modal
      open={open}
      onClose={() => !revokeMutation.isPending && onClose()}
      title={t.title}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
            <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Names the object and the consequence (lib/copy.ts rules) */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
          <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <span className="font-bold">{t.warning(certificate.certificateNumber, certificate.user?.name || 'Student')}</span>
          </div>
        </div>

        <div>
          <label htmlFor="revoke-reason" className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
            {t.reasonLabel} <span aria-hidden="true" className="text-[var(--secondary)]">*</span>
          </label>
          <textarea
            id="revoke-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.reasonPlaceholder}
            className="w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--ink)] placeholder:text-[var(--ink-soft)] transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-3">
          <DashboardButton variant="secondary" size="sm" disabled={revokeMutation.isPending} onClick={onClose}>
            {actions.cancel}
          </DashboardButton>
          <DashboardButton
            variant="danger"
            size="sm"
            type="submit"
            disabled={!reason.trim() || reason.trim().length < 3}
            loading={revokeMutation.isPending}
            loadingLabel={t.submitting}
          >
            <Ban aria-hidden="true" className="h-3.5 w-3.5" />
            {t.submit}
          </DashboardButton>
        </div>
      </form>
    </Modal>
  );
}
