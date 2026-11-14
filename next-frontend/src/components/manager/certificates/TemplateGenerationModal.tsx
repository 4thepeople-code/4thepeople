'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/common/Modal';
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
  Loader2,
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
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  eventId: string;
  eventTitle?: string;
  onSuccess?: () => void;
}

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
  isOpen,
  onClose,
  slug,
  eventId,
  eventTitle,
  onSuccess,
}: TemplateGenerationModalProps) {
  // Queries & Mutations
  const { data: students = [] } = useEligibleStudentsQuery(slug, eventId, isOpen);
  const { data: predefinedTemplates = [], isLoading: predefinedLoading } = usePredefinedTemplatesQuery(slug, eventId, isOpen);
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
    if (isOpen) {
      setStep('select_template');
      setFormError(null);
      setBatchResult(null);
      setSelectedStudentIds([]);
    }
  }, [isOpen]);

  // Handle custom file selection (PDF, PNG, JPG)
  const handleCustomFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const lower = file.name.toLowerCase();
    const isAllowed = lower.endsWith('.pdf') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg');
    if (!isAllowed) {
      setFormError('Please select a valid PDF, PNG, or JPEG template file (up to 15MB).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setFormError('File size exceeds the 15MB maximum limit.');
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
      setFormError('Please upload a template file or select a predefined template.');
      return;
    }
    if (templateSource === 'predefined' && !selectedPredefined) {
      setFormError('Please choose a predefined certificate template.');
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
        'Failed to save certificate template configuration.';
      setFormError(msg);
    } finally {
      setSaveLoading(false);
    }
  };

  // Dispatch Certificate Generation Batch
  const handleGenerate = async () => {
    setFormError(null);
    if (!savedTemplateId) {
      setFormError('Template configuration is missing. Please save again.');
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
        'Failed to generate certificates.';
      setFormError(msg);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Automated Certificate Generation (Method C)"
      maxWidth={step === 'editor' ? 'max-w-7xl' : 'max-w-4xl'}
    >
      <div className="flex flex-col h-full max-h-[88vh] font-sans">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#E7E5E4] dark:border-[#2D3139] bg-[#FAF9F7] dark:bg-[#1A1D24]">
          <div className="flex items-center gap-2 sm:gap-4 text-xs font-medium">
            <span
              className={`flex items-center gap-1.5 ${
                step === 'select_template'
                  ? 'text-[#B08D57] font-semibold'
                  : 'text-[#6B6966] dark:text-[#A8A5A0]'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-[#B08D57] text-white text-[11px]">
                1
              </span>
              <span>Select Design</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#A8A5A0]" />

            <span
              className={`flex items-center gap-1.5 ${
                step === 'editor'
                  ? 'text-[#B08D57] font-semibold'
                  : 'text-[#6B6966] dark:text-[#A8A5A0]'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                  step === 'editor'
                    ? 'bg-[#B08D57] text-white'
                    : 'bg-[#E7E5E4] dark:bg-[#2D3139] text-[#6B6966]'
                }`}
              >
                2
              </span>
              <span>Visual Editor & Preview</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#A8A5A0]" />

            <span
              className={`flex items-center gap-1.5 ${
                step === 'target' || step === 'result'
                  ? 'text-[#B08D57] font-semibold'
                  : 'text-[#6B6966] dark:text-[#A8A5A0]'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                  step === 'target' || step === 'result'
                    ? 'bg-[#B08D57] text-white'
                    : 'bg-[#E7E5E4] dark:bg-[#2D3139] text-[#6B6966]'
                }`}
              >
                3
              </span>
              <span>Issue & Generate</span>
            </span>
          </div>

          <div className="text-[11px] font-mono text-[#6B6966] dark:text-[#A8A5A0] hidden sm:block">
            {eligibleCandidates.length} eligible recipients
          </div>
        </div>

        {/* Global Error Banner */}
        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-900/60 rounded-lg flex items-center gap-2 text-xs text-red-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* STEP 1: Select Template Design (Option A vs Option B) */}
        {step === 'select_template' && (
          <div className="p-6 space-y-6 overflow-y-auto">
            {/* Template Source Selector Tabs */}
            <div className="flex items-center gap-2 border-b border-[#E7E5E4] dark:border-[#2D3139] pb-3">
              <button
                type="button"
                onClick={() => setTemplateSource('predefined')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                  templateSource === 'predefined'
                    ? 'bg-[#FAF4E8] dark:bg-amber-950/40 text-[#8A6421] dark:text-amber-300 border border-[#B08D57]'
                    : 'bg-[#FAF9F7] dark:bg-[#1A1D24] text-[#6B6966] hover:text-[#1C1B1F] border border-transparent'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#B08D57]" />
                <span>Option A: Professionally Predefined Templates</span>
              </button>
              <button
                type="button"
                onClick={() => setTemplateSource('custom')}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                  templateSource === 'custom'
                    ? 'bg-[#FAF4E8] dark:bg-amber-950/40 text-[#8A6421] dark:text-amber-300 border border-[#B08D57]'
                    : 'bg-[#FAF9F7] dark:bg-[#1A1D24] text-[#6B6966] hover:text-[#1C1B1F] border border-transparent'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-[#B08D57]" />
                <span>Option B: Upload Custom Background (PDF, PNG, JPG)</span>
              </button>
            </div>

            {/* Option A: Predefined Templates Gallery */}
            {templateSource === 'predefined' && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-serif font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                    Choose a Pre-Engineered Certificate Template
                  </h4>
                  <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0]">
                    These vector designs have pre-configured optical placeholder coordinates and typography.
                  </p>
                </div>

                {predefinedLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[#B08D57]" />
                    <span className="text-xs text-[#6B6966]">Loading template gallery...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {predefinedTemplates.map((tpl) => {
                      const isSelected = selectedPredefined?.id === tpl.id;
                      return (
                        <div
                          key={tpl.id}
                          onClick={() => handleSelectPredefined(tpl)}
                          className={`relative rounded-xl border-2 p-4 cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'border-[#B08D57] bg-[#FAF4E8]/60 dark:bg-amber-950/20 shadow-md ring-2 ring-[#B08D57]/20'
                              : 'border-[#E7E5E4] dark:border-[#2D3139] bg-white dark:bg-[#1A1D24] hover:border-[#B08D57]/60'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#B08D57] text-white flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}

                          {/* Visual Preview Swatch Card */}
                          <div
                            className="w-full h-28 rounded-lg mb-3 border border-black/10 flex flex-col items-center justify-center p-3 text-center relative overflow-hidden"
                            style={{ backgroundColor: tpl.backgroundColor || '#FAF7EE' }}
                          >
                            <span
                              className="text-[10px] font-serif font-bold uppercase tracking-widest line-clamp-1"
                              style={{ color: tpl.primaryTextColor || '#0A192F' }}
                            >
                              {tpl.name}
                            </span>
                            <span className="text-[8px] opacity-60 mt-1 font-mono">
                              A4 Landscape • 841 × 595 pt
                            </span>
                          </div>

                          <div className="space-y-1">
                            <h5 className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                              {tpl.name}
                            </h5>
                            <p className="text-[11px] text-[#6B6966] dark:text-[#A8A5A0] line-clamp-2">
                              {tpl.description}
                            </p>
                          </div>
                        </div>
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
                  <h4 className="text-sm font-serif font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                    Upload Custom Certificate Background
                  </h4>
                  <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0]">
                    Upload a high-resolution PDF certificate background or image (PNG, JPG, JPEG) exported from Canva,
                    Figma, or Photoshop (max 15MB).
                  </p>
                </div>

                <div className="relative border-2 border-dashed border-[#D8D7DC] dark:border-[#3D424E] hover:border-[#B08D57] rounded-xl p-8 text-center transition-colors bg-[#FAF9F7] dark:bg-[#1A1D24]">
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/jpg"
                    onChange={handleCustomFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-[#FAF4E8] dark:bg-amber-950/40 text-[#B08D57] flex items-center justify-center">
                      <Upload className="w-6 h-6" />
                    </div>
                    {templateFile ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                          Selected: {templateFile.name}
                        </p>
                        <p className="text-[11px] text-[#6B6966]">
                          {(templateFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for visual positioning
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                          Click or drag and drop your template file here
                        </p>
                        <p className="text-[11px] text-[#6B6966]">
                          Supports PDF documents and high-res PNG / JPEG graphics up to 15MB
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Template Display Name Input */}
            <div>
              <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1">
                Certificate Title / Template Label
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Certificate of Achievement — Code Warz 2026"
                className="w-full px-3 py-2 bg-white dark:bg-[#1A1D24] border border-[#D8D7DC] dark:border-[#3D424E] rounded-lg text-xs sm:text-sm text-[#1C1B1F] dark:text-[#F5F3EF] focus:outline-none focus:border-[#B08D57]"
              />
            </div>
          </div>
        )}

        {/* STEP 2: Visual Certificate Editor Canvas & Real PDF Preview */}
        {step === 'editor' && (
          <div className="flex-1 overflow-hidden">
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
          <div className="p-6 space-y-5 overflow-y-auto">
            <div>
              <h4 className="text-sm font-serif font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                Select Recipient Students
              </h4>
              <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0]">
                Choose whether to generate certificates for all eligible registered students or pick specific candidates.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTargetMode('all')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  targetMode === 'all'
                    ? 'border-[#B08D57] bg-[#FAF4E8]/60 dark:bg-amber-950/20 shadow-xs'
                    : 'border-[#E7E5E4] dark:border-[#2D3139] bg-white dark:bg-[#1A1D24]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                    All Eligible Students
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#B08D57] text-white">
                    {eligibleCandidates.length}
                  </span>
                </div>
                <p className="text-[11px] text-[#6B6966]">
                  Generate certificates for all registered attendees without an active certificate.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTargetMode('custom')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  targetMode === 'custom'
                    ? 'border-[#B08D57] bg-[#FAF4E8]/60 dark:bg-amber-950/20 shadow-xs'
                    : 'border-[#E7E5E4] dark:border-[#2D3139] bg-white dark:bg-[#1A1D24]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                    Select Specific Students
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#F2F0EC] dark:bg-[#2D3139] text-[#6B6966]">
                    {selectedStudentIds.length}
                  </span>
                </div>
                <p className="text-[11px] text-[#6B6966]">
                  Manually check off individual candidates from the attendee roster.
                </p>
              </button>
            </div>

            {targetMode === 'custom' && (
              <div className="border border-[#E7E5E4] dark:border-[#2D3139] rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#FAF9F7] dark:bg-[#252830] text-[#6B6966] font-medium border-b border-[#E7E5E4]">
                    <tr>
                      <th className="p-3 w-10">
                        <input
                          type="checkbox"
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
                          className="rounded accent-[#B08D57]"
                        />
                      </th>
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Roll Number</th>
                      <th className="p-3">Email Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F0EC] dark:divide-[#2D3139]">
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
                          className="hover:bg-[#FAF9F7] dark:hover:bg-[#252830] cursor-pointer"
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="rounded accent-[#B08D57]"
                            />
                          </td>
                          <td className="p-3 font-medium text-[#1C1B1F] dark:text-[#F5F3EF]">{c.user.name}</td>
                          <td className="p-3 font-mono text-[#6B6966]">{c.user.rollNumber || 'N/A'}</td>
                          <td className="p-3 text-[#6B6966]">{c.user.email}</td>
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
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-serif text-[#1C1B1F] dark:text-[#F5F3EF]">
              Certificates Generated Successfully!
            </h4>
            <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0] max-w-md mx-auto">
              All certificates have been generated with vector precision, signed, and published to student dashboards.
            </p>

            <div className="max-w-md mx-auto p-4 bg-[#FAF9F7] dark:bg-[#1A1D24] border border-[#E7E5E4] dark:border-[#2D3139] rounded-xl grid grid-cols-3 gap-3 text-center">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#6B6966] block">Issued</span>
                <span className="text-lg font-bold text-emerald-600">{batchResult.successCount}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#6B6966] block">Failed</span>
                <span className="text-lg font-bold text-rose-600">{batchResult.failedCount}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#6B6966] block">Total</span>
                <span className="text-lg font-bold text-[#1C1B1F] dark:text-[#F5F3EF]">{batchResult.totalCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="px-6 py-3.5 bg-white dark:bg-[#1A1D24] border-t border-[#E7E5E4] dark:border-[#2D3139] flex items-center justify-between">
          {step === 'select_template' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#F2F0EC] dark:bg-[#252830] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded-lg hover:bg-[#E7E5E4] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep('editor')}
                disabled={templateSource === 'custom' && !templateFile}
                className="px-5 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <span>Continue to Visual Editor</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {step === 'editor' && (
            <>
              <button
                type="button"
                onClick={() => setStep('select_template')}
                className="px-4 py-2 bg-[#F2F0EC] dark:bg-[#252830] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded-lg hover:bg-[#E7E5E4] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change Template</span>
              </button>

              <button
                type="button"
                onClick={() => void handleSaveAndProceedToTarget()}
                disabled={saveLoading}
                className="px-5 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {saveLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Template & Select Recipients</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {step === 'target' && (
            <>
              <button
                type="button"
                onClick={() => setStep('editor')}
                className="px-4 py-2 bg-[#F2F0EC] dark:bg-[#252830] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded-lg hover:bg-[#E7E5E4] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Editor</span>
              </button>

              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={generateMutation.isPending || (targetMode === 'custom' && selectedStudentIds.length === 0)}
                className="px-6 py-2 bg-[#14532D] hover:bg-[#166534] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {generateMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  Issue Certificates (
                  {targetMode === 'all' ? eligibleCandidates.length : selectedStudentIds.length} Students)
                </span>
              </button>
            </>
          )}

          {step === 'result' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default TemplateGenerationModal;
