'use client';

import React, { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import {
  useEventCertificatesQuery,
  useEligibleStudentsQuery,
} from '@/lib/api/manager';
import { IndividualUploadModal } from './IndividualUploadModal';
import { BulkUploadModal } from './BulkUploadModal';
import { TemplateGenerationModal } from './TemplateGenerationModal';
import { RevokeCertificateModal } from './RevokeCertificateModal';
import { ReissueCertificateModal } from './ReissueCertificateModal';
import {
  Award,
  Upload,
  Archive,
  Sparkles,
  Search,
  CheckCircle2,
  Ban,
  RefreshCw,
  Download,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldCheck,
  Users,
  FileCheck,
} from 'lucide-react';
import type { EventCertificate } from '@/types/models';

interface EventCertificatesSectionProps {
  slug: string;
  clubId?: string;
  eventId: string;
  eventTitle?: string;
}

export function EventCertificatesSection({
  slug,
  eventId,
  eventTitle,
}: EventCertificatesSectionProps) {
  const { isDark } = useTheme();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ISSUED' | 'REVOKED'>('ALL');
  const [page, setPage] = useState(1);
  const [copiedCertId, setCopiedCertId] = useState<string | null>(null);

  // Modal Open States
  const [isIndividualModalOpen, setIsIndividualModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [revokingCert, setRevokingCert] = useState<EventCertificate | null>(null);
  const [reissuingCert, setReissuingCert] = useState<EventCertificate | null>(null);

  // Queries
  const {
    data: certsData,
    isLoading: certsLoading,
    refetch: refetchCerts,
  } = useEventCertificatesQuery(slug, eventId, page, statusFilter, searchQuery);

  const { data: eligibleStudents = [], refetch: refetchEligible } = useEligibleStudentsQuery(slug, eventId);

  const certificates = certsData?.certificates || [];
  const pagination = certsData?.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 };

  const handleCopyNumber = (certNumber?: string) => {
    if (!certNumber) return;
    navigator.clipboard.writeText(certNumber);
    setCopiedCertId(certNumber);
    setTimeout(() => setCopiedCertId(null), 2000);
  };

  const handleRefresh = () => {
    refetchCerts();
    refetchEligible();
  };

  const coveragePercent =
    Array.isArray(eligibleStudents) && eligibleStudents.length > 0
      ? Math.round(
          (eligibleStudents.filter((s) => Boolean(s?.hasActiveCertificate)).length /
            eligibleStudents.length) *
            100
        )
      : 0;

  return (
    <section
      aria-label="Event Certificates Section"
      className="relative rounded-3xl border-2 border-[var(--primary)]/35 bg-[var(--surface)] p-6 sm:p-8 shadow-xl shadow-[var(--primary)]/5 space-y-7 overflow-hidden transition-all"
    >
      {/* Top Colorful Accent Ribbon */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[var(--primary)] via-indigo-500 to-amber-500" />

      {/* Section Header: Prominently Highlighted Title and Description */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-[var(--line)] pb-6">
        <div className="space-y-2">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary)]/30 text-[10px] font-bold uppercase tracking-wider shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Official Accreditation & Verification Hub</span>
          </div>

          {/* Highlighted Title and Description */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-indigo-600 text-white flex items-center justify-center shadow-md shadow-[var(--primary)]/30 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)]">
                Event Certificates
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-[var(--ink-soft)] mt-0.5 leading-relaxed">
                Issue, auto-generate, and audit verifiable participation certificates for registered attendees.
              </p>
            </div>
          </div>
        </div>

        {/* Issuance Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsIndividualModalOpen(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-xs font-bold text-[var(--ink)] transition-colors hover:bg-[var(--primary-soft)]/60 hover:border-[var(--primary)]/40 cursor-pointer shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>Individual PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-2 text-xs font-bold text-[var(--ink)] transition-colors hover:bg-[var(--primary-soft)]/60 hover:border-[var(--primary)]/40 cursor-pointer shadow-xs"
          >
            <Archive className="w-3.5 h-3.5 text-amber-500" />
            <span>Bulk ZIP</span>
          </button>

          <button
            type="button"
            onClick={() => setIsTemplateModalOpen(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-white transition-all hover:bg-[var(--primary-strong)] shadow-md shadow-[var(--primary)]/25 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Generate</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards - High-Contrast & Clearly Highlighted */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] shadow-xs transition-colors hover:border-[var(--primary)]/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              Certificates Issued
            </span>
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display text-3xl font-extrabold text-[var(--ink)]">
              {pagination.total}
            </span>
            <span className="text-xs font-semibold text-[var(--ink-soft)]">total records</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] shadow-xs transition-colors hover:border-[var(--primary)]/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              Eligible Attendees
            </span>
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display text-3xl font-extrabold text-[var(--primary)]">
              {eligibleStudents.length}
            </span>
            <span className="text-xs font-semibold text-[var(--ink-soft)]">registered</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] shadow-xs transition-colors hover:border-[var(--primary)]/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              Award Coverage
            </span>
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {coveragePercent}%
            </span>
            <span className="text-xs font-semibold text-[var(--ink-soft)]">awarded</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        {/* Status Tabs */}
        <div className="inline-flex p-1 rounded-xl bg-[var(--bg)] border border-[var(--line)] self-start shadow-xs">
          {(['ALL', 'ISSUED', 'REVOKED'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setStatusFilter(tab);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                statusFilter === tab
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              {tab === 'ALL' ? 'All' : tab === 'ISSUED' ? 'Issued' : 'Revoked'}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
          <input
            type="text"
            placeholder="Search by student, roll #, or cert #..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-3.5 py-2.5 text-xs font-medium rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] placeholder-[var(--ink-soft)]/50 focus:border-[var(--primary)] focus:outline-hidden focus:ring-1 focus:ring-[var(--primary)] transition-colors shadow-xs"
          />
        </div>
      </div>

      {/* Certificates Table & Empty States */}
      {certsLoading ? (
        <div className="py-14 flex flex-col items-center justify-center text-xs font-semibold text-[var(--ink-soft)] space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-[var(--primary)]" />
          <span>Loading event certificates...</span>
        </div>
      ) : certificates.length === 0 ? (
        <div className="py-12 text-center text-xs font-medium space-y-3 border-2 border-dashed border-[var(--line)] bg-[var(--bg)]/50 rounded-2xl p-8">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center shadow-xs">
            <Award className="w-6 h-6" />
          </div>
          <div className="font-display text-base font-bold text-[var(--ink)]">
            No certificates found
          </div>
          <p className="text-xs text-[var(--ink-soft)] max-w-md mx-auto leading-relaxed">
            No certificates match your current filters. Use the actions above to auto-generate certificates from a template, upload individual PDFs, or import in bulk.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                  <th className="py-3 px-4">Student Recipient</th>
                  <th className="py-3 px-4">Certificate Number</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Issued At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {certificates.map((cert) => {
                  const isIssued = cert.status === 'ISSUED';
                  const downloadUrl = `/api/manager/events/${eventId}/certificates/${cert.id}/download?college=${slug}`;

                  return (
                    <tr
                      key={cert.id}
                      className="hover:bg-[var(--primary-soft)]/20 transition-colors"
                    >
                      {/* Recipient */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {cert.user?.avatar?.url ? (
                            <img
                              src={cert.user.avatar.url}
                              alt={cert.user?.name || 'User'}
                              className="w-8 h-8 rounded-full object-cover border border-[var(--line)]"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center font-bold text-xs uppercase border border-[var(--primary)]/20">
                              {(cert.user?.name || 'Student').slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-[var(--ink)]">{cert.user?.name || 'Student'}</div>
                            <div className="text-[11px] font-medium text-[var(--ink-soft)]">
                              {cert.user?.rollNumber || 'No Roll #'} • {cert.user?.email || '—'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Certificate Number */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[var(--ink)] bg-[var(--bg)] px-2 py-0.5 rounded-md border border-[var(--line)]">
                          <span>{cert.certificateNumber || '—'}</span>
                          {cert.certificateNumber && (
                            <button
                              type="button"
                              onClick={() => handleCopyNumber(cert.certificateNumber)}
                              className="p-1 rounded-md hover:bg-[var(--primary-soft)] text-[var(--ink-soft)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                              title="Copy Certificate Number"
                            >
                              {copiedCertId === cert.certificateNumber ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Source Method */}
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--bg)] text-[var(--ink-soft)] border border-[var(--line)] uppercase">
                          {cert.source === 'INDIVIDUAL_UPLOAD'
                            ? 'Single Upload'
                            : cert.source === 'BULK_UPLOAD'
                            ? 'Bulk ZIP'
                            : 'Generated'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isIssued ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 uppercase">
                            <CheckCircle2 className="w-3 h-3" /> Issued
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20 cursor-help uppercase"
                            title={cert.revocationReason || 'Revoked by administrator'}
                          >
                            <Ban className="w-3 h-3" /> Revoked
                          </span>
                        )}
                      </td>

                      {/* Issued Date */}
                      <td className="py-3 px-4 text-[var(--ink-soft)] text-[11px] font-medium">
                        {(() => {
                          if (!cert.issuedAt) return '—';
                          const d = new Date(cert.issuedAt);
                          return isNaN(d.getTime())
                            ? '—'
                            : d.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              });
                        })()}
                      </td>

                      {/* Action Menu */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {/* Download / View Button */}
                          <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink-soft)] hover:text-[var(--primary)] hover:border-[var(--primary)]/50 hover:bg-[var(--primary-soft)]/20 transition-colors shadow-xs"
                            title="View / Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>

                          {/* Reissue Button */}
                          <button
                            type="button"
                            onClick={() => setReissuingCert(cert)}
                            className="p-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink-soft)] hover:text-[var(--primary)] hover:border-[var(--primary)]/50 hover:bg-[var(--primary-soft)]/20 transition-colors cursor-pointer shadow-xs"
                            title="Reissue Certificate"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Revoke Button (only active if currently ISSUED) */}
                          {isIssued && (
                            <button
                              type="button"
                              onClick={() => setRevokingCert(cert)}
                              className="p-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink-soft)] hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors cursor-pointer shadow-xs"
                              title="Revoke Certificate"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
              <span className="text-xs font-medium text-[var(--ink-soft)]">
                Page {page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--primary-soft)]/40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--primary-soft)]/40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <IndividualUploadModal
        isOpen={isIndividualModalOpen}
        onClose={() => setIsIndividualModalOpen(false)}
        slug={slug}
        eventId={eventId}
        eventTitle={eventTitle}
        onSuccess={handleRefresh}
      />

      <BulkUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        slug={slug}
        eventId={eventId}
        onSuccess={handleRefresh}
      />

      <TemplateGenerationModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        slug={slug}
        eventId={eventId}
        eventTitle={eventTitle}
        onSuccess={handleRefresh}
      />

      <RevokeCertificateModal
        isOpen={Boolean(revokingCert)}
        onClose={() => setRevokingCert(null)}
        slug={slug}
        eventId={eventId}
        certificate={revokingCert}
        onSuccess={handleRefresh}
      />

      <ReissueCertificateModal
        isOpen={Boolean(reissuingCert)}
        onClose={() => setReissuingCert(null)}
        slug={slug}
        eventId={eventId}
        certificate={reissuingCert}
        onSuccess={handleRefresh}
      />
    </section>
  );
}

export default EventCertificatesSection;
