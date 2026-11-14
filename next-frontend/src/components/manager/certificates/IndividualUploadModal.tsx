'use client';

import React, { useState, useMemo } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Modal } from '@/components/common/Modal';
import {
  useEligibleStudentsQuery,
  useIssueIndividualCertificateMutation,
} from '@/lib/api/manager';
import {
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  UserCheck,
  X,
} from 'lucide-react';
import type { EligibleStudentItem } from '@/types/models';

interface IndividualUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  eventId: string;
  eventTitle?: string;
  onSuccess?: () => void;
}

export function IndividualUploadModal({
  isOpen,
  onClose,
  slug,
  eventId,
  eventTitle,
  onSuccess,
}: IndividualUploadModalProps) {
  const { isDark } = useTheme();

  // Queries & Mutations
  const { data: students = [], isLoading: studentsLoading } = useEligibleStudentsQuery(
    slug,
    eventId,
    isOpen
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
      setFormError('Only valid PDF documents (.pdf) are accepted.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormError('PDF file size must not exceed 10 MB.');
      return;
    }

    setSelectedFile(file);
  };

  const handleSelectStudent = (student: EligibleStudentItem) => {
    setFormError(null);
    if (student.hasActiveCertificate) {
      setFormError(`Student '${student.user.name}' already has an active certificate. Reissue or revoke first.`);
      return;
    }
    setSelectedStudent(student);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedStudent) {
      setFormError('Please select a registered student.');
      return;
    }

    if (selectedStudent.hasActiveCertificate) {
      setFormError('Selected student already has an active certificate.');
      return;
    }

    if (!selectedFile) {
      setFormError('Please select a PDF certificate file to upload.');
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
        'Failed to issue certificate';
      setFormError(msg);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !issueMutation.isPending && onClose()}
      title="Issue Individual Certificate"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {eventTitle && (
          <p className="text-xs text-slate-400">
            Issuing credential for: <strong className="text-slate-200">{eventTitle}</strong>
          </p>
        )}

        {formError && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-300 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* Step 1: Select Student */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
            1. Select Registered Student <span className="text-rose-400">*</span>
          </label>

          {selectedStudent ? (
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs uppercase">
                  {(selectedStudent.user.name || 'S').slice(0, 2)}
                </div>
                <div>
                  <div className="font-bold text-sm">{selectedStudent.user.name}</div>
                  <div className="text-xs text-slate-400">
                    Roll: {selectedStudent.user.rollNumber || 'N/A'} • {selectedStudent.user.email}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search registered attendees by name, roll number, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none transition ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white focus:border-cyan-500'
                      : 'bg-white border-slate-200 text-slate-900 focus:border-cyan-500'
                  }`}
                />
              </div>

              {studentsLoading ? (
                <div className="py-6 flex items-center justify-center text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading registered attendees...
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  {students.length === 0
                    ? 'No students have registered for this event yet.'
                    : 'No matching attendees found.'}
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 divide-y divide-white/5 border border-white/10 rounded-2xl p-1">
                  {filteredStudents.map((item) => (
                    <div
                      key={item.registrationId}
                      onClick={() => !item.hasActiveCertificate && handleSelectStudent(item)}
                      className={`p-2.5 rounded-xl flex items-center justify-between text-xs transition cursor-pointer ${
                        item.hasActiveCertificate
                          ? 'opacity-50 cursor-not-allowed bg-white/5'
                          : isDark
                          ? 'hover:bg-white/10 text-slate-200'
                          : 'hover:bg-slate-100 text-slate-900'
                      }`}
                    >
                      <div>
                        <div className="font-bold">{item.user.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {item.user.rollNumber || 'No Roll #'} • {item.user.email}
                        </div>
                      </div>
                      {item.hasActiveCertificate ? (
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Active Cert Issued
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-cyan-400 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" /> Select
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Upload PDF Document */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
            2. Upload Certificate PDF <span className="text-rose-400">*</span>
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
                <FileText className="w-8 h-8 text-cyan-400 shrink-0" />
                <div className="text-left">
                  <div className="font-bold text-xs text-slate-200 truncate max-w-xs">
                    {selectedFile.name}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB • application/pdf
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
                  Click to choose PDF file
                </span>
                <span className="text-xs text-slate-400 block mt-1">
                  or drag and drop certificate document (Max 10 MB)
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
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            disabled={issueMutation.isPending}
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!selectedStudent || !selectedFile || issueMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            {issueMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Issuing Certificate...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Issue Certificate</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
