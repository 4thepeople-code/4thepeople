'use client';

import React, { useState } from 'react';
import Modal from '@/components/dashboard/ui/Modal';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import { actions, managerCertificates } from '@/lib/copy';
import { useReissueCertificateMutation } from '@/lib/api/manager';
import { RefreshCw, Upload, AlertCircle, FileText, X } from 'lucide-react';
import type { EventCertificate } from '@/types/models';

interface ReissueCertificateModalProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  eventId: string;
  certificate: EventCertificate | null;
  onSuccess?: () => void;
}

const t = managerCertificates.reissue;

export function ReissueCertificateModal({
  open,
  onClose,
  slug,
  eventId,
  certificate,
  onSuccess,
}: ReissueCertificateModalProps) {
  const reissueMutation = useReissueCertificateMutation(slug, eventId);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setFormError(t.errPdfType);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormError(t.errPdfSize);
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!certificate) return;
    if (!selectedFile) {
      setFormError(t.errNoFile);
      return;
    }

    try {
      await reissueMutation.mutateAsync({
        certificateId: certificate.id,
        file: selectedFile,
      });

      setSelectedFile(null);
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
      onClose={() => !reissueMutation.isPending && onClose()}
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
        <div className="space-y-1 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3.5 text-xs">
          <div className="text-[var(--ink-soft)]">{t.forLine}</div>
          <div className="text-sm font-bold text-[var(--ink)]">{certificate.user?.name || 'Student'}</div>
          <div className="text-[11px] text-[var(--ink-soft)]">
            {t.currentCert} <code className="font-mono text-[var(--primary)]">{certificate.certificateNumber}</code>
          </div>
          <div className="pt-1 text-[11px] text-amber-800">
            {t.consequence}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
            {t.fileLabel} <span aria-hidden="true" className="text-[var(--secondary)]">*</span>
          </span>
          <div className="rounded-2xl border-2 border-dashed border-[var(--line)] bg-[var(--bg)] p-5 text-center transition-colors hover:border-[var(--primary)]/50 motion-reduce:transition-none">
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileText aria-hidden="true" className="h-7 w-7 shrink-0 text-[var(--primary)]" />
                <div className="text-left">
                  <div className="max-w-xs truncate text-xs font-bold text-[var(--ink)]">{selectedFile.name}</div>
                  <div className="text-[11px] text-[var(--ink-soft)]">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  aria-label={actions.close}
                  className="ml-2 grid h-9 w-9 place-items-center rounded-lg text-[var(--ink-soft)] transition-colors hover:bg-[var(--primary-soft)] hover:text-[var(--ink)] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="block cursor-pointer rounded-xl focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
                <Upload aria-hidden="true" className="mx-auto mb-1 h-7 w-7 text-[var(--ink-soft)]" />
                <span className="text-xs font-semibold text-[var(--primary)] hover:underline">
                  {t.chooseFile}
                </span>
                <span className="mt-0.5 block text-[11px] text-[var(--ink-soft)]">{t.maxSize}</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-3">
          <DashboardButton variant="secondary" size="sm" disabled={reissueMutation.isPending} onClick={onClose}>
            {actions.cancel}
          </DashboardButton>
          <DashboardButton
            variant="primary"
            size="sm"
            type="submit"
            disabled={!selectedFile}
            loading={reissueMutation.isPending}
            loadingLabel={t.submitting}
          >
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            {t.submit}
          </DashboardButton>
        </div>
      </form>
    </Modal>
  );
}
