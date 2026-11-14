'use client';

import React, { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Modal } from '@/components/common/Modal';
import {
  saveCertificateTemplateApi,
  previewCertificateTemplateApi,
  useGenerateCertificatesMutation,
  useEligibleStudentsQuery,
} from '@/lib/api/manager';
import {
  Sparkles,
  Upload,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react';
import type { PlaceholderConfigItem, CertificateBatch } from '@/types/models';

interface TemplateGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  eventId: string;
  eventTitle?: string;
  onSuccess?: () => void;
}

const DEFAULT_CONFIG: PlaceholderConfigItem[] = [
  { placeholder: '{{studentName}}', x: 300, y: 250, size: 22, font: 'HelveticaBold', color: '#0F172A', align: 'center' },
  { placeholder: '{{rollNumber}}', x: 300, y: 215, size: 14, font: 'Helvetica', color: '#475569', align: 'center' },
  { placeholder: '{{eventName}}', x: 300, y: 175, size: 16, font: 'HelveticaBold', color: '#0F172A', align: 'center' },
  { placeholder: '{{issueDate}}', x: 150, y: 80, size: 11, font: 'Helvetica', color: '#64748B', align: 'left' },
  { placeholder: '{{certificateId}}', x: 450, y: 80, size: 11, font: 'Helvetica', color: '#64748B', align: 'center' },
];

const AVAILABLE_PLACEHOLDERS = [
  '{{studentName}}',
  '{{rollNumber}}',
  '{{eventName}}',
  '{{issueDate}}',
  '{{certificateId}}',
  '{{collegeName}}',
];

export function TemplateGenerationModal({
  isOpen,
  onClose,
  slug,
  eventId,
  eventTitle,
  onSuccess,
}: TemplateGenerationModalProps) {
  const { isDark } = useTheme();

  // Queries & Mutations
  const { data: students = [] } = useEligibleStudentsQuery(slug, eventId, isOpen);
  const generateMutation = useGenerateCertificatesMutation(slug, eventId);

  // Flow State
  const [step, setStep] = useState<'configure' | 'target' | 'result'>('configure');
  const [templateName, setTemplateName] = useState('Official Event Certificate');
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [config, setConfig] = useState<PlaceholderConfigItem[]>(DEFAULT_CONFIG);

  // Target Selection State
  const [targetMode, setTargetMode] = useState<'all' | 'custom'>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Preview & Processing State
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<CertificateBatch | null>(null);

  // Eligible students without active certificate
  const eligibleCandidates = students.filter((s) => !s.hasActiveCertificate);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setFormError('Only PDF template files (.pdf) are accepted.');
      return;
    }

    setTemplateFile(file);
    setSavedTemplateId(null);
  };

  const handleUpdateConfigItem = (idx: number, updates: Partial<PlaceholderConfigItem>) => {
    setConfig((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
  };

  const handleRemovePlaceholder = (idx: number) => {
    setConfig((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddPlaceholder = (placeholder: string) => {
    if (config.some((c) => c.placeholder === placeholder)) return;
    setConfig((prev) => [
      ...prev,
      { placeholder, x: 300, y: 150, size: 14, font: 'Helvetica', color: '#0F172A', align: 'center' },
    ]);
  };

  const handlePreview = async () => {
    setFormError(null);
    if (!templateFile && !savedTemplateId) {
      setFormError('Please select a PDF template file first.');
      return;
    }

    setPreviewLoading(true);
    try {
      const blob = await previewCertificateTemplateApi(
        slug,
        eventId,
        config,
        {
          studentName: 'Alex Mercer',
          rollNumber: '23761A0599',
          eventName: eventTitle || 'Campus Hackathon 2026',
        },
        savedTemplateId || undefined,
        templateFile || undefined
      );

      const previewUrl = URL.createObjectURL(blob);
      window.open(previewUrl, '_blank');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error).message ||
        'Preview generation failed';
      setFormError(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSaveAndProceed = async () => {
    setFormError(null);
    if (!templateFile && !savedTemplateId) {
      setFormError('Please select a PDF template file.');
      return;
    }

    setSaveLoading(true);
    try {
      if (templateFile) {
        const saved = await saveCertificateTemplateApi(slug, eventId, templateName, config, templateFile);
        setSavedTemplateId(saved.id);
      }
      setStep('target');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error).message ||
        'Failed to save template';
      setFormError(msg);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleGenerate = async () => {
    setFormError(null);
    if (!savedTemplateId) {
      setFormError('Template is missing. Please re-upload.');
      return;
    }

    try {
      const result = await generateMutation.mutateAsync({
        templateId: savedTemplateId,
        studentUserIds: targetMode === 'custom' ? selectedStudentIds : null,
      });

      setBatchResult(result);
      setStep('result');
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error).message ||
        'Generation failed';
      setFormError(msg);
    }
  };

  const handleToggleSelectStudent = (userId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !generateMutation.isPending && !saveLoading && onClose()}
      title="Automated Certificate Generation"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        {formError && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-300 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* STEP 1: CONFIGURE TEMPLATE */}
        {step === 'configure' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Template Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border outline-none transition ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white focus:border-cyan-500'
                      : 'bg-white border-slate-200 text-slate-900 focus:border-cyan-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Upload PDF Template <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="template-upload-input"
                  />
                  <label
                    htmlFor="template-upload-input"
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl border cursor-pointer transition ${
                      isDark ? 'bg-black/30 border-white/10 hover:border-cyan-500' : 'bg-white border-slate-200 hover:border-cyan-500'
                    }`}
                  >
                    <span className="truncate text-slate-300">
                      {templateFile ? templateFile.name : savedTemplateId ? 'Existing Template Selected' : 'Choose PDF Template...'}
                    </span>
                    <Upload className="w-4 h-4 text-cyan-400 shrink-0 ml-2" />
                  </label>
                </div>
              </div>
            </div>

            {/* Placeholders Coordinate Config Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Placeholder Coordinates & Styling
                </label>
                <span className="text-[10px] text-slate-400">
                  Coordinates measured in PDF points from bottom-left origin
                </span>
              </div>

              {/* Available placeholders buttons */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white/5 border border-white/10 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 mr-1">Add:</span>
                {AVAILABLE_PLACEHOLDERS.map((ph) => {
                  const exists = config.some((c) => c.placeholder === ph);
                  return (
                    <button
                      key={ph}
                      type="button"
                      disabled={exists}
                      onClick={() => handleAddPlaceholder(ph)}
                      className={`text-[10px] px-2 py-0.5 rounded-lg border transition ${
                        exists
                          ? 'opacity-40 border-white/5 text-slate-500'
                          : 'border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10'
                      }`}
                    >
                      {ph}
                    </button>
                  );
                })}
              </div>

              {/* Active Placeholders Rows */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {config.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl border flex flex-wrap sm:flex-nowrap items-center gap-2.5 text-xs ${
                      isDark ? 'bg-black/20 border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="font-mono font-bold text-cyan-400 text-[11px] w-32 shrink-0 truncate">
                      {item.placeholder}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">X:</span>
                      <input
                        type="number"
                        value={item.x}
                        onChange={(e) => handleUpdateConfigItem(idx, { x: Number(e.target.value) })}
                        className="w-16 px-1.5 py-1 text-[11px] rounded-lg border border-white/10 bg-black/30 text-white outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">Y:</span>
                      <input
                        type="number"
                        value={item.y}
                        onChange={(e) => handleUpdateConfigItem(idx, { y: Number(e.target.value) })}
                        className="w-16 px-1.5 py-1 text-[11px] rounded-lg border border-white/10 bg-black/30 text-white outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">Size:</span>
                      <input
                        type="number"
                        value={item.size || 16}
                        onChange={(e) => handleUpdateConfigItem(idx, { size: Number(e.target.value) })}
                        className="w-14 px-1.5 py-1 text-[11px] rounded-lg border border-white/10 bg-black/30 text-white outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">Align:</span>
                      <select
                        value={item.align || 'center'}
                        onChange={(e) => handleUpdateConfigItem(idx, { align: e.target.value as 'left' | 'center' })}
                        className="px-1.5 py-1 text-[11px] rounded-lg border border-white/10 bg-black/30 text-white outline-none"
                      >
                        <option value="center">Center</option>
                        <option value="left">Left</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={item.color || '#000000'}
                        onChange={(e) => handleUpdateConfigItem(idx, { color: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemovePlaceholder(idx)}
                      className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10 transition ml-auto"
                      title="Remove Placeholder"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 1 Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <button
                type="button"
                disabled={previewLoading || (!templateFile && !savedTemplateId)}
                onClick={handlePreview}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold rounded-xl border border-cyan-500/30 transition disabled:opacity-40"
              >
                {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                <span>Preview Sample PDF</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saveLoading || (!templateFile && !savedTemplateId)}
                  onClick={handleSaveAndProceed}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Next: Select Recipients & Generate</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: SELECT RECIPIENTS & GENERATE */}
        {step === 'target' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Choose Target Recipients
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setTargetMode('all')}
                  className={`p-4 rounded-2xl border cursor-pointer transition ${
                    targetMode === 'all'
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center justify-between">
                    <span>All Eligible Students ({eligibleCandidates.length})</span>
                    {targetMode === 'all' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                  </div>
                  <p className="text-[11px] opacity-80 mt-1">
                    Generates certificates for all registered attendees without an active certificate.
                  </p>
                </div>

                <div
                  onClick={() => setTargetMode('custom')}
                  className={`p-4 rounded-2xl border cursor-pointer transition ${
                    targetMode === 'custom'
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center justify-between">
                    <span>Select Specific Students ({selectedStudentIds.length})</span>
                    {targetMode === 'custom' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                  </div>
                  <p className="text-[11px] opacity-80 mt-1">
                    Choose individual registered students from the checklist below.
                  </p>
                </div>
              </div>
            </div>

            {/* Custom Student Selector Checklist */}
            {targetMode === 'custom' && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400">Select Attendees:</span>
                <div className="max-h-52 overflow-y-auto divide-y divide-white/5 border border-white/10 rounded-2xl p-2 text-xs">
                  {students.map((item) => {
                    const isSelected = selectedStudentIds.includes(item.user.id);
                    return (
                      <div
                        key={item.registrationId}
                        onClick={() => !item.hasActiveCertificate && handleToggleSelectStudent(item.user.id)}
                        className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition ${
                          item.hasActiveCertificate
                            ? 'opacity-40 cursor-not-allowed bg-white/5'
                            : isSelected
                            ? 'bg-cyan-500/10 text-cyan-200'
                            : 'hover:bg-white/5 text-slate-200'
                        }`}
                      >
                        <div>
                          <div className="font-bold">{item.user.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {item.user.rollNumber || 'No Roll #'} • {item.user.email}
                          </div>
                        </div>
                        {item.hasActiveCertificate ? (
                          <span className="text-[10px] text-emerald-400">Already Issued</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-white/20 text-cyan-500 pointer-events-none"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2 Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setStep('configure')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
              >
                Back to Template Config
              </button>

              <button
                type="button"
                disabled={
                  generateMutation.isPending ||
                  (targetMode === 'all' && eligibleCandidates.length === 0) ||
                  (targetMode === 'custom' && selectedStudentIds.length === 0)
                }
                onClick={handleGenerate}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating Certificates...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Certificates</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RESULTS SUMMARY */}
        {step === 'result' && batchResult && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-2xl border ${
                batchResult.status === 'COMPLETED'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm mb-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Certificate Generation Finished</span>
              </div>
              <p className="text-xs opacity-90">
                Successfully generated and issued {batchResult.successCount} certificates (
                {batchResult.skippedCount} skipped, {batchResult.failedCount} failed).
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Generated
                </span>
                <span className="text-xl font-black text-emerald-300">{batchResult.successCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                  Skipped (Has Cert)
                </span>
                <span className="text-xl font-black text-amber-300">{batchResult.skippedCount}</span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">
                  Failed
                </span>
                <span className="text-xl font-black text-rose-300">{batchResult.failedCount}</span>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl transition"
              >
                Close & View Certificates
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
