'use client';

import React, { useState } from 'react';
import Modal from '@/components/dashboard/ui/Modal';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import { actions, managerCertificates } from '@/lib/copy';
import { useUploadBulkCertificatesMutation } from '@/lib/api/manager';
import {
  Archive,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import type { CertificateBatch } from '@/types/models';

interface BulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  eventId: string;
  onSuccess?: () => void;
}

const t = managerCertificates.bulk;

export function BulkUploadModal({
  open,
  onClose,
  slug,
  eventId,
  onSuccess,
}: BulkUploadModalProps) {
  const bulkMutation = useUploadBulkCertificatesMutation(slug, eventId);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<CertificateBatch | null>(null);

  const handleDownloadSampleCsv = () => {
    const csvHeader = 'rollNumber,filename\n23761A05A1,23761A05A1.pdf\n23761A05A2,23761A05A2.pdf\n';
    const blob = new Blob([csvHeader], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manifest_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    setBatchResult(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setFormError(t.errZipType);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setFormError(t.errZipSize);
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedFile) {
      setFormError(t.errNoFile);
      return;
    }

    try {
      const result = await bulkMutation.mutateAsync(selectedFile);
      setBatchResult(result);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error).message ||
        t.errSubmit;
      setFormError(msg);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setBatchResult(null);
    setFormError(null);
  };

  return (
    <Modal
      open={open}
      onClose={() => !bulkMutation.isPending && onClose()}
      title={t.title}
      size="lg"
    >
      <div className="space-y-5">
        {formError && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-700">
            <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* If batch result is present, display processing summary */}
        {batchResult ? (
          <div className="space-y-4">
            <div
              className={`rounded-2xl border p-4 ${
                batchResult.status === 'COMPLETED'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : batchResult.status === 'COMPLETED_WITH_ERRORS'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              <div className="mb-1 flex items-center gap-2 text-sm font-bold">
                {batchResult.status === 'COMPLETED' ? (
                  <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-emerald-600" />
                ) : batchResult.status === 'COMPLETED_WITH_ERRORS' ? (
                  <AlertTriangle aria-hidden="true" className="h-5 w-5 text-amber-600" />
                ) : (
                  <AlertCircle aria-hidden="true" className="h-5 w-5 text-rose-600" />
                )}
                <span>
                  {batchResult.status === 'COMPLETED'
                    ? t.resultComplete
                    : batchResult.status === 'COMPLETED_WITH_ERRORS'
                    ? t.resultPartial
                    : t.resultFailed}
                </span>
              </div>
              <p className="text-xs opacity-90">
                {t.resultSummary(batchResult.totalCount, batchResult.successCount, batchResult.failedCount, batchResult.skippedCount)}
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                  {t.statTotal}
                </span>
                <span className="text-xl font-black text-[var(--ink)]">{batchResult.totalCount}</span>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  {t.statIssued}
                </span>
                <span className="text-xl font-black text-emerald-700">{batchResult.successCount}</span>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-rose-700">
                  {t.statFailed}
                </span>
                <span className="text-xl font-black text-rose-700">{batchResult.failedCount}</span>
              </div>
            </div>

            {/* Error Breakdown */}
            {batchResult.errorDetails && batchResult.errorDetails.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                  {t.issuesTitle(batchResult.errorDetails.length)}
                </h4>
                <ul className="max-h-48 divide-y divide-[var(--line)] overflow-y-auto rounded-2xl border border-[var(--line)] p-2 text-xs">
                  {batchResult.errorDetails.map((err, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3 px-2 py-2">
                      <div>
                        <div className="font-semibold text-[var(--ink)]">
                          {err.rollNumber || 'N/A'} • {err.filename || 'N/A'}
                        </div>
                        <div className="mt-0.5 text-[11px] text-rose-700">{err.reason}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-3">
              <DashboardButton variant="secondary" size="sm" onClick={handleReset}>
                {t.uploadAnother}
              </DashboardButton>
              <DashboardButton variant="primary" size="sm" onClick={onClose}>
                {t.done}
              </DashboardButton>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Structure Instructions */}
            <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4 text-xs text-[var(--ink-soft)]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold text-[var(--ink)]">
                  <Archive aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" /> {t.archiveTitle}
                </span>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="inline-flex min-h-8 items-center gap-1 text-[11px] font-semibold text-[var(--primary)] hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  <FileSpreadsheet aria-hidden="true" className="h-3.5 w-3.5" /> {t.sampleCsv}
                </button>
              </div>
              <p className="text-[11px]">{t.archiveHint}</p>
              <pre className="overflow-x-auto rounded-xl bg-[var(--primary-soft)]/60 p-2.5 font-mono text-[10px] text-[var(--ink)]">
{`certificates.zip
├── manifest.csv
└── certificates/
    ├── 23761A05A1.pdf
    └── 23761A05A2.pdf`}
              </pre>
            </div>

            {/* Archive Uploader */}
            <div className="space-y-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                {t.zipLabel} <span aria-hidden="true" className="text-[var(--secondary)]">*</span>
              </span>

              <div className="rounded-2xl border-2 border-dashed border-[var(--line)] bg-[var(--bg)] p-6 text-center transition-colors hover:border-[var(--primary)]/50 motion-reduce:transition-none">
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <Archive aria-hidden="true" className="h-8 w-8 shrink-0 text-[var(--primary)]" />
                    <div className="text-left">
                      <div className="max-w-xs truncate text-xs font-bold text-[var(--ink)]">
                        {selectedFile.name}
                      </div>
                      <div className="text-[11px] text-[var(--ink-soft)]">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • application/zip
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
                    <Upload aria-hidden="true" className="mx-auto mb-2 h-8 w-8 text-[var(--ink-soft)]" />
                    <span className="text-xs font-semibold text-[var(--primary)] hover:underline">
                      {t.dropEmpty}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--ink-soft)]">
                      {t.dropHint}
                    </span>
                    <input
                      type="file"
                      accept=".zip,application/zip"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-3">
              <DashboardButton variant="secondary" size="sm" disabled={bulkMutation.isPending} onClick={onClose}>
                {actions.cancel}
              </DashboardButton>
              <DashboardButton
                variant="primary"
                size="sm"
                type="submit"
                disabled={!selectedFile}
                loading={bulkMutation.isPending}
                loadingLabel={t.submitting}
              >
                <Upload aria-hidden="true" className="h-4 w-4" />
                {t.submit}
              </DashboardButton>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
