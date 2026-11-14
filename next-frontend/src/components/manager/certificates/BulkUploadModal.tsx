'use client';

import React, { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Modal } from '@/components/common/Modal';
import { useUploadBulkCertificatesMutation } from '@/lib/api/manager';
import {
  Archive,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import type { CertificateBatch } from '@/types/models';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  eventId: string;
  onSuccess?: () => void;
}

export function BulkUploadModal({
  isOpen,
  onClose,
  slug,
  eventId,
  onSuccess,
}: BulkUploadModalProps) {
  const { isDark } = useTheme();
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
      setFormError('Only ZIP archives (.zip) are accepted.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setFormError('Archive file size must not exceed 25 MB.');
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedFile) {
      setFormError('Please select a ZIP archive file.');
      return;
    }

    try {
      const result = await bulkMutation.mutateAsync(selectedFile);
      setBatchResult(result);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error).message ||
        'Bulk upload failed';
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
      isOpen={isOpen}
      onClose={() => !bulkMutation.isPending && onClose()}
      title="Bulk Certificates Upload"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {formError && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-300 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* If batch result is present, display processing summary */}
        {batchResult ? (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-2xl border ${
                batchResult.status === 'COMPLETED'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : batchResult.status === 'COMPLETED_WITH_ERRORS'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm mb-1">
                {batchResult.status === 'COMPLETED' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : batchResult.status === 'COMPLETED_WITH_ERRORS' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                )}
                <span>
                  {batchResult.status === 'COMPLETED'
                    ? 'All Certificates Issued Successfully!'
                    : batchResult.status === 'COMPLETED_WITH_ERRORS'
                    ? 'Batch Processed with Some Errors'
                    : 'Batch Upload Failed'}
                </span>
              </div>
              <p className="text-xs opacity-90">
                Processed {batchResult.totalCount} entries: {batchResult.successCount} issued,{' '}
                {batchResult.failedCount} failed, {batchResult.skippedCount} skipped.
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total Records
                </span>
                <span className="text-xl font-black text-white">{batchResult.totalCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Issued
                </span>
                <span className="text-xl font-black text-emerald-300">{batchResult.successCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">
                  Failed
                </span>
                <span className="text-xl font-black text-rose-300">{batchResult.failedCount}</span>
              </div>
            </div>

            {/* Error Breakdown Table */}
            {batchResult.errorDetails && batchResult.errorDetails.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Issues & Failure Details ({batchResult.errorDetails.length})
                </h4>
                <div className="max-h-48 overflow-y-auto divide-y divide-white/5 border border-white/10 rounded-2xl p-2 text-xs">
                  {batchResult.errorDetails.map((err, idx) => (
                    <div key={idx} className="py-2 px-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-200">
                          {err.rollNumber || 'N/A'} • {err.filename || 'N/A'}
                        </div>
                        <div className="text-[11px] text-rose-400 mt-0.5">{err.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                Upload Another Batch
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Structure Instructions */}
            <div
              className={`p-4 rounded-2xl border text-xs space-y-2 ${
                isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Archive className="w-4 h-4 text-cyan-400" /> Archive Requirements
                </span>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:underline"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Download Sample CSV
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Your ZIP archive must contain a root or folder-level <strong>manifest.csv</strong> with columns{' '}
                <code className="text-cyan-400">rollNumber,filename</code> and the corresponding PDF certificate files.
              </p>
              <pre className="p-2.5 rounded-xl bg-black/40 text-[10px] text-slate-400 font-mono overflow-x-auto">
{`certificates.zip
├── manifest.csv
└── certificates/
    ├── 23761A05A1.pdf
    └── 23761A05A2.pdf`}
              </pre>
            </div>

            {/* Archive Uploader */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Upload ZIP Archive <span className="text-rose-400">*</span>
              </label>

              <div
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition ${
                  isDark
                    ? 'border-white/10 hover:border-cyan-500/50 bg-black/20'
                    : 'border-slate-200 hover:border-cyan-500/50 bg-slate-50'
                }`}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <Archive className="w-8 h-8 text-cyan-400 shrink-0" />
                    <div className="text-left">
                      <div className="font-bold text-xs text-slate-200 truncate max-w-xs">
                        {selectedFile.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • application/zip
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
                    <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                    <span className="text-xs font-semibold text-cyan-400 hover:underline">
                      Click to choose ZIP file
                    </span>
                    <span className="text-xs text-slate-400 block mt-1">
                      or drag and drop archive (Max 25 MB)
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
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                disabled={bulkMutation.isPending}
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedFile || bulkMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {bulkMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Archive...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload & Process ZIP</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
