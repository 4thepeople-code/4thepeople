'use client';

import React, { useState, useMemo } from 'react';
import Modal from '@/components/dashboard/ui/Modal';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import { actions, managerCertificates } from '@/lib/copy';
import {
  useEligibleStudentsQuery,
  useIssueIndividualCertificateMutation,
} from '@/lib/api/manager';
import {
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  X,
} from 'lucide-react';
import type { EligibleStudentItem } from '@/types/models';

interface IndividualUploadModalProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  eventId: string;
  eventTitle?: string;
  onSuccess?: () => void;
}

const t = managerCertificates.individual;

export function IndividualUploadModal({
  open,
  onClose,
  slug,
  eventId,
  eventTitle,
  onSuccess,
}: IndividualUploadModalProps) {
  // Queries & Mutations
  const { data: students = [], isLoading: studentsLoading } = useEligibleStudentsQuery(
    slug,
    eventId,
    open
  );
  const issueMutation = useIssueIndividualCertificateMutation(slug, eventId);

  // Form State
  const [selectedStudent, setSelectedStudent] = useState<EligibleStudentItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        s.user.name?.toLowerCase().includes(q) ||
        s.user.rollNumber?.toLowerCase().includes(q) ||
        s.user.email?.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

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

  const handleSelectStudent = (student: EligibleStudentItem) => {
    setFormError(null);
    if (student.hasActiveCertificate) {
      setFormError(t.alreadyIssuedError(student.user.name || t.fallbackStudent));
      return;
    }
    setSelectedStudent(student);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedStudent) {
      setFormError(t.errNoStudent);
      return;
    }

    if (selectedStudent.hasActiveCertificate) {
      setFormError(t.alreadyIssuedError(selectedStudent.user.name || t.fallbackStudent));
      return;
    }

    if (!selectedFile) {
      setFormError(t.errNoFile);
      return;
    }

    try {
      await issueMutation.mutateAsync({
        userId: selectedStudent.user.id,
        file: selectedFile,
      });

      // Reset state and close
      setSelectedStudent(null);
      setSelectedFile(null);
      setSearchQuery('');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error).message ||
        t.errSubmit;
      setFormError(msg);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !issueMutation.isPending && onClose()}
      title={t.title}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {eventTitle && (
          <p className="text-xs text-[var(--ink-soft)]">
            {t.contextLine(eventTitle)}
          </p>
        )}

        {formError && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-700">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Step 1: Select Student */}
        <div className="space-y-2">
          <span className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
            {t.stepStudent} <span aria-hidden="true" className="text-[var(--secondary)]">*</span>
          </span>

          {selectedStudent ? (
            <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3.5">
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="grid h-9 w-9 place-items-center rounded-full bg-[var(--primary-soft)] text-xs font-bold uppercase text-[var(--primary)]"
                >
                  {(selectedStudent.user.name || 'S').slice(0, 2)}
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--ink)]">{selectedStudent.user.name}</div>
                  <div className="text-xs text-[var(--ink-soft)]">
                    {t.rollLabel} {selectedStudent.user.rollNumber || 'N/A'} • {selectedStudent.user.email}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                aria-label={actions.close}
                className="grid h-9 w-9 place-items-center rounded-xl text-[var(--ink-soft)] transition-colors hover:bg-[var(--primary-soft)] hover:text-[var(--ink)] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <label htmlFor="individual-student-search" className="sr-only">
                  {t.searchPlaceholder}
                </label>
                <Search aria-hidden="true" className="absolute left-3 top-2.5 h-4 w-4 text-[var(--ink-soft)]" />
                <input
                  id="individual-student-search"
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] py-2 pl-9 pr-3 text-xs text-[var(--ink)] placeholder:text-[var(--ink-soft)] transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
                />
              </div>

              {studentsLoading ? (
                <div className="flex items-center justify-center py-6 text-xs text-[var(--ink-soft)]" role="status" aria-label={t.loadingStudents}>
                  <span aria-hidden="true" className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none" />
                  {t.loadingStudents}…
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--ink-soft)]">
                  {students.length === 0 ? t.noStudents : t.noMatches}
                </div>
              ) : (
                <ul className="max-h-48 space-y-1 divide-y divide-[var(--line)] overflow-y-auto rounded-2xl border border-[var(--line)] p-1">
                  {filteredStudents.map((item) => (
                    <li key={item.registrationId}>
                      <button
                        type="button"
                        onClick={() => !item.hasActiveCertificate && handleSelectStudent(item)}
                        disabled={item.hasActiveCertificate}
                        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl p-2.5 text-left text-xs transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                          item.hasActiveCertificate
                            ? 'cursor-not-allowed bg-[var(--bg)] text-[var(--ink-soft)] opacity-60'
                            : 'cursor-pointer text-[var(--ink)] hover:bg-[var(--primary-soft)]/60'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{item.user.name}</span>
                          <span className="block truncate text-[11px] text-[var(--ink-soft)]">
                            {item.user.rollNumber || t.noRoll} • {item.user.email}
                          </span>
                        </span>
                        {item.hasActiveCertificate ? (
                          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            {t.alreadyIssued}
                          </span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-[var(--primary)]">
                            <UserCheck aria-hidden="true" className="h-3.5 w-3.5" /> {t.select}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Upload PDF Document */}
        <div className="space-y-2">
          <span className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]">
            {t.stepFile} <span aria-hidden="true" className="text-[var(--secondary)]">*</span>
          </span>

          <div className="rounded-2xl border-2 border-dashed border-[var(--line)] bg-[var(--bg)] p-5 text-center transition-colors hover:border-[var(--primary)]/50 motion-reduce:transition-none">
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileText aria-hidden="true" className="h-8 w-8 shrink-0 text-[var(--primary)]" />
                <div className="text-left">
                  <div className="max-w-xs truncate text-xs font-bold text-[var(--ink)]">
                    {selectedFile.name}
                  </div>
                  <div className="text-[11px] text-[var(--ink-soft)]">
                    {(selectedFile.size / 1024).toFixed(1)} KB • application/pdf
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
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-3">
          <DashboardButton variant="secondary" size="sm" disabled={issueMutation.isPending} onClick={onClose}>
            {actions.cancel}
          </DashboardButton>
          <DashboardButton
            variant="primary"
            size="sm"
            type="submit"
            disabled={!selectedStudent || !selectedFile}
            loading={issueMutation.isPending}
            loadingLabel={t.submitting}
          >
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            {t.submit}
          </DashboardButton>
        </div>
      </form>
    </Modal>
  );
}
