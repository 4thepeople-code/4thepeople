'use client';

import React, { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Modal } from '@/components/common/Modal';
import { useReissueCertificateMutation } from '@/lib/api/manager';
import { RefreshCw, Upload, AlertCircle, Loader2, FileText, X } from 'lucide-react';
import type { EventCertificate } from '@/types/models';

interface ReissueCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  eventId: string;
  certificate: EventCertificate | null;
  onSuccess?: () => void;
}

export function ReissueCertificateModal({
  isOpen,
  onClose,
  slug,
  eventId,
  certificate,
  onSuccess,
}: ReissueCertificateModalProps) {
  const { isDark } = useTheme();
  const reissueMutation = useReissueCertificateMutation(slug, eventId);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setFormError('Only valid PDF documents (.pdf) are accepted.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormError('PDF file size must not exceed 10 MB.');
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!certificate) return;
    if (!selectedFile) {
      setFormError('Please select a replacement PDF certificate.');
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
        'Failed to reissue certificate';
      setFormError(msg);
    }
  };

  if (!certificate) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !reissueMutation.isPending && onClose()}
      title="Reissue Certificate"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-2.5 text-rose-300 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <div
          className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
            isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="text-slate-400">Reissuing certificate for:</div>
          <div className="font-bold text-sm text-slate-200">{certificate.user?.name || 'Student'}</div>
          <div className="text-[11px] text-slate-400">
            Current Cert: <code className="text-cyan-400">{certificate.certificateNumber}</code>
          </div>
          <div className="text-[11px] text-amber-400 pt-1">
            Note: This action will revoke the previous certificate and issue a fresh, audited replacement.
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Upload Replacement PDF <span className="text-rose-400">*</span>
          </label>
          <div
            className={`border-2 border-dashed rounded-2xl p-5 text-center transition ${
              isDark
                ? 'border-white/10 hover:border-cyan-500/50 bg-black/20'
                : 'border-slate-200 hover:border-cyan-500/50 bg-slate-50'
            }`}
          >
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="w-7 h-7 text-cyan-400 shrink-0" />
                <div className="text-left">
                  <div className="font-bold text-xs text-slate-200 truncate max-w-xs">{selectedFile.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <Upload className="w-7 h-7 mx-auto text-slate-400 mb-1" />
                <span className="text-xs font-semibold text-cyan-400 hover:underline">
                  Choose replacement PDF file
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Max 10 MB</span>
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

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            disabled={reissueMutation.isPending}
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!selectedFile || reissueMutation.isPending}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50"
          >
            {reissueMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Reissuing...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Reissue Certificate</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
