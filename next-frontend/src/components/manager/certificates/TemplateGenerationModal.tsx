'use client';

import React, { useState, useEffect } from 'react';
import Modal from '@/components/dashboard/ui/Modal';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import { managerCertificates } from '@/lib/copy';
import {
  saveCertificateTemplateApi,
  useGenerateCertificatesMutation,
  useEligibleStudentsQuery,
  usePredefinedTemplatesQuery,
} from '@/lib/api/manager';
import {
  Sparkles,
  Upload,
  CheckCircle2,
  AlertCircle,
  Check,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import type {
  PlaceholderConfigItem,
  CertificateBatch,
  PredefinedTemplate,
} from '@/types/models';
import VisualCertificateEditor from './VisualCertificateEditor';

interface TemplateGenerationModalProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  eventId: string;
  eventTitle?: string;
  onSuccess?: () => void;
}

const t = managerCertificates.template;

const DEFAULT_NORMALIZED_CONFIG: PlaceholderConfigItem[] = [
  {
    id: '{{studentName}}',
    placeholder: '{{studentName}}',
    xPercent: 50,
    yPercent: 38.7,
    widthPercent: 80,
    fontSize: 24,
    font: 'HelveticaBold',
    color: '#0F172A',
    align: 'center',
    autoFit: true,
  },
  {
    id: '{{rollNumber}}',
    placeholder: '{{rollNumber}}',
    xPercent: 50,
    yPercent: 44.5,
    widthPercent: 60,
    fontSize: 13,
    font: 'Helvetica',
    color: '#475569',
    align: 'center',
    autoFit: true,
  },
  {
    id: '{{eventName}}',
    placeholder: '{{eventName}}',
    xPercent: 50,
    yPercent: 54.0,
    widthPercent: 75,
    fontSize: 18,
    font: 'HelveticaBold',
    color: '#0F172A',
    align: 'center',
    autoFit: true,
  },
  {
    id: '{{issueDate}}',
    placeholder: '{{issueDate}}',
    xPercent: 20,
    yPercent: 87.5,
    widthPercent: 35,
    fontSize: 10,
    font: 'Helvetica',
    color: '#64748B',
    align: 'left',
    autoFit: true,
  },
  {
    id: '{{certificateId}}',
    placeholder: '{{certificateId}}',
    xPercent: 80,
    yPercent: 87.5,
    widthPercent: 35,
    fontSize: 10,
    font: 'Helvetica',
    color: '#64748B',
    align: 'right',
    autoFit: true,
  },
];

export function TemplateGenerationModal({
  open,
  onClose,
  slug,
  eventId,
  eventTitle,
  onSuccess,
}: TemplateGenerationModalProps) {
  // Queries & Mutations
  const { data: students = [] } = useEligibleStudentsQuery(slug, eventId, open);
  const { data: predefinedTemplates = [], isLoading: predefinedLoading } = usePredefinedTemplatesQuery(slug, eventId, open);
  const generateMutation = useGenerateCertificatesMutation(slug, eventId);

  // Modal Flow Step: 'select_template' -> 'editor' -> 'target' -> 'result'
  const [step, setStep] = useState<'select_template' | 'editor' | 'target' | 'result'>('select_template');

  // Option Selection
  const [templateSource, setTemplateSource] = useState<'predefined' | 'custom'>('predefined');
  const [selectedPredefined, setSelectedPredefined] = useState<PredefinedTemplate | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);

  // Template Metadata & Positions
  const [templateName, setTemplateName] = useState('Official Event Certificate');
  const [config, setConfig] = useState<PlaceholderConfigItem[]>(DEFAULT_NORMALIZED_CONFIG);
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);

  // Target Recipients State
  const [targetMode, setTargetMode] = useState<'all' | 'custom'>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Loading & Processing States
  const [saveLoading, setSaveLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<CertificateBatch | null>(null);

  // Automatically select the first predefined template when loaded
  useEffect(() => {
    if (predefinedTemplates.length > 0 && !selectedPredefined) {
      const first = predefinedTemplates[0];
      setSelectedPredefined(first);
      if (first.defaultConfig && Array.isArray(first.defaultConfig)) {
        setConfig(first.defaultConfig);
      }
    }
  }, [predefinedTemplates, selectedPredefined]);

  // Eligible candidates without active certificates
  const eligibleCandidates = students.filter((s) => !s.hasActiveCertificate);

  // Reset state on modal open
  useEffect(() => {
    if (open) {
      setStep('select_template');
      setFormError(null);
      setBatchResult(null);
      setSelectedStudentIds([]);
    }
  }, [open]);

  // Handle custom file selection (PDF, PNG, JPG)
  const handleCustomFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const lower = file.name.toLowerCase();
    const isAllowed = lower.endsWith('.pdf') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg');
    if (!isAllowed) {
      setFormError(t.errFileType);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setFormError(t.errFileSize);
      return;
    }

    setTemplateFile(file);
    setTemplateSource('custom');
    setSavedTemplateId(null);
  };

  // Select a Predefined Template
  const handleSelectPredefined = (tpl: PredefinedTemplate) => {
    setSelectedPredefined(tpl);
    setTemplateSource('predefined');
    setTemplateFile(null);
    setTemplateName(tpl.name);
    if (tpl.defaultConfig && Array.isArray(tpl.defaultConfig)) {
      setConfig(tpl.defaultConfig);
    }
  };

  // Save template and proceed to Target Selection
  const handleSaveAndProceedToTarget = async () => {
    setFormError(null);
    if (templateSource === 'custom' && !templateFile && !savedTemplateId) {
      setFormError(t.errNoTemplate);
      return;
    }
    if (templateSource === 'predefined' && !selectedPredefined) {
      setFormError(t.errNoPredefined);
      return;
    }

    setSaveLoading(true);
    try {
      const saved = await saveCertificateTemplateApi(slug, eventId, templateName, config, {
        templateFile: templateSource === 'custom' ? templateFile : null,
        predefinedTemplateId: templateSource === 'predefined' ? selectedPredefined?.id : null,
      });

      setSavedTemplateId(saved.id);
      setStep('target');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error).message ||
        t.errSave;
      setFormError(msg);
    } finally {
      setSaveLoading(false);
    }
  };

  // Dispatch Certificate Generation Batch
  const handleGenerate = async () => {
    setFormError(null);
    if (!savedTemplateId) {
      setFormError(t.errMissingTemplate);
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
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error).message ||
        t.errGenerate;
      setFormError(msg);
    }
  };

  const stepPill = (index: number, label: string, active: boolean, done: boolean) => (
    <span
      className={`flex items-center gap-1.5 ${
        active ? 'font-semibold text-[var(--primary)]' : 'text-[var(--ink-soft)]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
          active
            ? 'bg-[var(--primary)] text-[var(--on-primary)]'
            : done
            ? 'bg-[var(--primary)]/15 text-[var(--primary)]'
            : 'bg-[var(--primary-soft)] text-[var(--ink-soft)]'
        }`}
      >
        {done ? <Check className="h-3 w-3 stroke-[3]" /> : index}
      </span>
      <span>{label}</span>
    </span>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.title}
      size={step === 'editor' ? '2xl' : 'xl'}
      flush
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Step Indicator Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] bg-[var(--bg)] px-6 py-3">
          <div className="flex items-center gap-2 text-xs font-medium sm:gap-4">
            {stepPill(1, t.stepSelect, step === 'select_template', step !== 'select_template')}
            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-[var(--ink-soft)]" />
            {stepPill(2, t.stepEditor, step === 'editor', step === 'target' || step === 'result')}
            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-[var(--ink-soft)]" />
            {stepPill(3, t.stepIssue, step === 'target' || step === 'result', step === 'result')}
          </div>

          <div className="hidden font-mono text-[11px] text-[var(--ink-soft)] sm:block">
            {t.eligibleCount(eligibleCandidates.length)}
          </div>
        </div>

        {/* Global Error Banner */}
        {formError && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* STEP 1: Select Template Design (Option A vs Option B) */}
        {step === 'select_template' && (
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
            {/* Template Source Selector Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-3">
              <button
                type="button"
                onClick={() => setTemplateSource('predefined')}
                aria-pressed={templateSource === 'predefined'}
                className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                  templateSource === 'predefined'
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'border-transparent bg-[var(--bg)] text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
              >
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                <span>{t.optionPredefined}</span>
              </button>
              <button
                type="button"
                onClick={() => setTemplateSource('custom')}
                aria-pressed={templateSource === 'custom'}
                className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                  templateSource === 'custom'
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'border-transparent bg-[var(--bg)] text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
              >
                <Upload aria-hidden="true" className="h-3.5 w-3.5" />
                <span>{t.optionCustom}</span>
              </button>
            </div>

            {/* Option A: Predefined Templates Gallery */}
            {templateSource === 'predefined' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--ink)]">
                    {t.predefinedHeading}
                  </h4>
                  <p className="text-xs text-[var(--ink-soft)]">
                    {t.predefinedHint}
                  </p>
                </div>

                {predefinedLoading ? (
                  <div className="flex flex-col items-center justify-center space-y-2 py-12" role="status" aria-label={t.loadingTemplates}>
                    <span aria-hidden="true" className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)]/30 border-t-[var(--primary)] motion-reduce:animate-none" />
                    <span className="text-xs text-[var(--ink-soft)]">{t.loadingTemplates}…</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {predefinedTemplates.map((tpl) => {
                      const isSelected = selectedPredefined?.id === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => handleSelectPredefined(tpl)}
                          aria-pressed={isSelected}
                          className={`relative flex cursor-pointer flex-col justify-between rounded-xl border-2 p-4 text-left transition-all motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                            isSelected
                              ? 'border-[var(--primary)] bg-[var(--primary-soft)]/60 shadow-sm ring-2 ring-[var(--primary)]/20'
                              : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--primary)]/60'
                          }`}
                        >
                          {isSelected && (
                            <span aria-hidden="true" className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)]">
                              <Check className="h-3 w-3 stroke-[3]" />
                            </span>
                          )}

                          {/* Visual Preview Swatch Card */}
                          <span
                            aria-hidden="true"
                            className="mb-3 flex h-28 w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-black/10 p-3 text-center"
                            style={{ backgroundColor: tpl.backgroundColor || '#FAF7EE' }}
                          >
                            <span
                              className="line-clamp-1 text-[10px] font-bold uppercase tracking-widest"
                              style={{ color: tpl.primaryTextColor || '#0A192F' }}
                            >
                              {tpl.name}
                            </span>
                            <span className="mt-1 font-mono text-[8px] opacity-60">
                              {t.predefinedSize}
                            </span>
                          </span>

                          <span className="space-y-1">
                            <h5 className="block text-xs font-semibold text-[var(--ink)]">
                              {tpl.name}
                            </h5>
                            <p className="line-clamp-2 block text-[11px] text-[var(--ink-soft)]">
                              {tpl.description}
                            </p>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Option B: Custom File Upload */}
            {templateSource === 'custom' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--ink)]">
                    {t.customHeading}
                  </h4>
                  <p className="text-xs text-[var(--ink-soft)]">
                    {t.customHint}
                  </p>
                </div>

                <div className="relative rounded-xl border-2 border-dashed border-[var(--line)] bg-[var(--bg)] p-8 text-center transition-colors hover:border-[var(--primary)] motion-reduce:transition-none">
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/jpg"
                    onChange={handleCustomFileChange}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label={t.customHeading}
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div
                      aria-hidden="true"
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)]"
                    >
                      <Upload className="h-6 w-6" />
                    </div>
                    {templateFile ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-[var(--ink)]">
                          {t.selectedFile} {templateFile.name}
                        </p>
                        <p className="text-[11px] text-[var(--ink-soft)]">
                          {(templateFile.size / (1024 * 1024)).toFixed(2)} MB • {t.readyForEditor}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-[var(--ink)]">
                          {t.dropCustom}
                        </p>
                        <p className="text-[11px] text-[var(--ink-soft)]">
                          {t.dropCustomHint}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Template Display Name Input */}
            <div>
              <label htmlFor="template-name" className="mb-1 block text-xs font-medium text-[var(--ink-soft)]">
                {t.nameLabel}
              </label>
              <input
                id="template-name"
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={t.namePlaceholder}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] placeholder:text-[var(--ink-soft)] transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none sm:text-sm"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Visual Certificate Editor Canvas & Real PDF Preview */}
        {step === 'editor' && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <VisualCertificateEditor
              templateSource={templateSource}
              predefinedTemplate={selectedPredefined}
              customFile={templateFile}
              config={config}
              onChangeConfig={setConfig}
              students={eligibleCandidates}
              eventTitle={eventTitle || 'Campus Hackathon 2026'}
              slug={slug}
              eventId={eventId}
            />
          </div>
        )}

        {/* STEP 3: Target Recipients Selection */}
        {step === 'target' && (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
            <div>
              <h4 className="text-sm font-semibold text-[var(--ink)]">
                {t.recipientsHeading}
              </h4>
              <p className="text-xs text-[var(--ink-soft)]">
                {t.recipientsHint}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setTargetMode('all')}
                aria-pressed={targetMode === 'all'}
                className={`cursor-pointer rounded-xl border p-4 text-left transition-all motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                  targetMode === 'all'
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)]/60 shadow-xs'
                    : 'border-[var(--line)] bg-[var(--surface)]'
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--ink)]">
                    {t.allStudents}
                  </span>
                  <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 font-mono text-[10px] text-[var(--on-primary)]">
                    {eligibleCandidates.length}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--ink-soft)]">
                  {t.allStudentsHint}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTargetMode('custom')}
                aria-pressed={targetMode === 'custom'}
                className={`cursor-pointer rounded-xl border p-4 text-left transition-all motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                  targetMode === 'custom'
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)]/60 shadow-xs'
                    : 'border-[var(--line)] bg-[var(--surface)]'
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--ink)]">
                    {t.customStudents}
                  </span>
                  <span className="rounded-full bg-[var(--primary-soft)] px-2 py-0.5 font-mono text-[10px] text-[var(--primary)]">
                    {selectedStudentIds.length}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--ink-soft)]">
                  {t.customStudentsHint}
                </p>
              </button>
            </div>

            {targetMode === 'custom' && (
              <div className="max-h-60 overflow-y-auto rounded-xl border border-[var(--line)]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--line)] bg-[var(--bg)] font-medium text-[var(--ink-soft)]">
                    <tr>
                      <th className="w-10 p-3">
                        <input
                          type="checkbox"
                          aria-label={t.allStudents}
                          checked={
                            selectedStudentIds.length === eligibleCandidates.length && eligibleCandidates.length > 0
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIds(eligibleCandidates.map((s) => s.user.id));
                            } else {
                              setSelectedStudentIds([]);
                            }
                          }}
                          className="rounded accent-[var(--primary)]"
                        />
                      </th>
                      <th className="p-3">{t.tableStudent}</th>
                      <th className="p-3">{t.tableRoll}</th>
                      <th className="p-3">{t.tableEmail}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {eligibleCandidates.map((c) => {
                      const isChecked = selectedStudentIds.includes(c.user.id);
                      return (
                        <tr
                          key={c.registrationId || c.user.id}
                          onClick={() => {
                            setSelectedStudentIds((prev) =>
                              isChecked ? prev.filter((id) => id !== c.user.id) : [...prev, c.user.id]
                            );
                          }}
                          className="cursor-pointer hover:bg-[var(--primary-soft)]/40 motion-reduce:transition-none"
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              aria-label={c.user.name || t.tableStudent}
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded accent-[var(--primary)]"
                            />
                          </td>
                          <td className="p-3 font-medium text-[var(--ink)]">{c.user.name}</td>
                          <td className="p-3 font-mono text-[var(--ink-soft)]">{c.user.rollNumber || 'N/A'}</td>
                          <td className="p-3 text-[var(--ink-soft)]">{c.user.email}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* STEP 4 (Result): Generation Summary */}
        {step === 'result' && batchResult && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-8 text-center">
            <div
              aria-hidden="true"
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
            >
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h4 className="font-display text-xl font-bold text-[var(--ink)]">
              {t.resultTitle}
            </h4>
            <p className="mx-auto max-w-md text-xs text-[var(--ink-soft)]">
              {t.resultHint}
            </p>

            <div className="mx-auto grid max-w-md grid-cols-3 gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 text-center">
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-[var(--ink-soft)]">{t.resultIssued}</span>
                <span className="text-lg font-bold text-emerald-700">{batchResult.successCount}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-[var(--ink-soft)]">{t.resultFailed}</span>
                <span className="text-lg font-bold text-rose-700">{batchResult.failedCount}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-[var(--ink-soft)]">{t.resultTotal}</span>
                <span className="text-lg font-bold text-[var(--ink)]">{batchResult.totalCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="flex shrink-0 items-center justify-between border-t border-[var(--line)] bg-[var(--surface)] px-6 py-3.5">
          {step === 'select_template' && (
            <>
              <DashboardButton variant="secondary" size="sm" onClick={onClose}>
                {t.cancel}
              </DashboardButton>
              <DashboardButton
                variant="primary"
                size="sm"
                onClick={() => setStep('editor')}
                disabled={templateSource === 'custom' && !templateFile}
                leftIcon={null}
              >
                {t.continueToEditor}
                <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
              </DashboardButton>
            </>
          )}

          {step === 'editor' && (
            <>
              <DashboardButton
                variant="secondary"
                size="sm"
                onClick={() => setStep('select_template')}
                leftIcon={<ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />}
              >
                {t.changeTemplate}
              </DashboardButton>

              <DashboardButton
                variant="primary"
                size="sm"
                onClick={() => void handleSaveAndProceedToTarget()}
                loading={saveLoading}
                loadingLabel={t.saveAndSelect}
              >
                {t.saveAndSelect}
                <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
              </DashboardButton>
            </>
          )}

          {step === 'target' && (
            <>
              <DashboardButton
                variant="secondary"
                size="sm"
                onClick={() => setStep('editor')}
                leftIcon={<ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />}
              >
                {t.backToEditor}
              </DashboardButton>

              <DashboardButton
                variant="primary"
                size="sm"
                onClick={() => void handleGenerate()}
                disabled={targetMode === 'custom' && selectedStudentIds.length === 0}
                loading={generateMutation.isPending}
                loadingLabel={t.issueCount(targetMode === 'all' ? eligibleCandidates.length : selectedStudentIds.length)}
              >
                {t.issueCount(targetMode === 'all' ? eligibleCandidates.length : selectedStudentIds.length)}
              </DashboardButton>
            </>
          )}

          {step === 'result' && (
            <div className="flex w-full justify-end">
              <DashboardButton variant="primary" size="sm" onClick={onClose}>
                {t.done}
              </DashboardButton>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default TemplateGenerationModal;
