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

  const handleCopyNumber = (certNumber: string) => {
    navigator.clipboard.writeText(certNumber);
    setCopiedCertId(certNumber);
    setTimeout(() => setCopiedCertId(null), 2000);
  };

  const handleRefresh = () => {
    refetchCerts();
    refetchEligible();
  };

  return (
    <div
      className={`rounded-3xl p-6 sm:p-8 border shadow-xl space-y-6 transition-all ${
        isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white border-[#E8E6DF]'
      }`}
    >
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Award className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-black uppercase tracking-wider text-slate-100">
              Event Certificates
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Issue, auto-generate, and audit official participation certificates for registered attendees.
          </p>
        </div>

        {/* Issuance Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsIndividualModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-white/10 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Individual PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-white/10 transition cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5 text-amber-400" />
            <span>Bulk ZIP</span>
          </button>

          <button
            type="button"
            onClick={() => setIsTemplateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Generate</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Certificates Issued
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-white">{pagination.total}</span>
            <span className="text-xs text-slate-400">total records</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Eligible Registered Students
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-cyan-400">{eligibleStudents.length}</span>
            <span className="text-xs text-slate-400">attendees</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Coverage
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-400">
              {eligibleStudents.length > 0
                ? Math.round((eligibleStudents.filter((s) => s.hasActiveCertificate).length / eligibleStudents.length) * 100)
                : 0}
              %
            </span>
            <span className="text-xs text-slate-400">students awarded</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Status Tabs */}
        <div className="inline-flex p-1 rounded-xl bg-white/5 border border-white/10 self-start">
          {(['ALL', 'ISSUED', 'REVOKED'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setStatusFilter(tab);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                statusFilter === tab
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'ALL' ? 'All' : tab === 'ISSUED' ? 'Issued' : 'Revoked'}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student, roll #, or cert #..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none transition ${
              isDark
                ? 'bg-black/30 border-white/10 text-white placeholder-slate-500 focus:border-cyan-500'
                : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-cyan-500'
            }`}
          />
        </div>
      </div>

      {/* Certificates Table */}
      {certsLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-xs text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mb-2 text-cyan-400" />
          <span>Loading event certificates...</span>
        </div>
      ) : certificates.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs font-medium space-y-2 border border-dashed border-white/10 rounded-2xl">
          <Award className="w-8 h-8 mx-auto text-slate-600 mb-1" />
          <div>No certificates found matching your criteria.</div>
          <p className="text-[11px] text-slate-500">
            Use the actions above to issue certificates individually, upload in bulk, or auto-generate from a template.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr
                  className={`border-b text-[10px] font-black uppercase tracking-wider ${
                    isDark ? 'border-white/10 text-slate-400' : 'border-[#E8E6DF] text-[#64748B]'
                  }`}
                >
                  <th className="py-3 px-4">Student Recipient</th>
                  <th className="py-3 px-4">Certificate Number</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Issued At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {certificates.map((cert) => {
                  const isIssued = cert.status === 'ISSUED';
                  const downloadUrl = `/api/manager/events/${eventId}/certificates/${cert.id}/download?college=${slug}`;

                  return (
                    <tr
                      key={cert.id}
                      className={`transition-colors ${
                        isDark ? 'hover:bg-white/5 text-slate-200' : 'hover:bg-slate-50 text-slate-900'
                      }`}
                    >
                      {/* Recipient */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {cert.user?.avatar?.url ? (
                            <img
                              src={cert.user.avatar.url}
                              alt={cert.user.name || 'User'}
                              className="w-8 h-8 rounded-full object-cover border border-white/10"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs uppercase">
                              {(cert.user?.name || 'S').slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-200">{cert.user?.name || 'Student'}</div>
                            <div className="text-[11px] text-slate-400">
                              {cert.user?.rollNumber || 'No Roll #'} • {cert.user?.email || '—'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Certificate Number */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-300">
                        <div className="inline-flex items-center gap-1.5">
                          <span>{cert.certificateNumber}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyNumber(cert.certificateNumber)}
                            className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition"
                            title="Copy Certificate Number"
                          >
                            {copiedCertId === cert.certificateNumber ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Source Method */}
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10">
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
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Issued
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20 cursor-help"
                            title={cert.revocationReason || 'Revoked by administrator'}
                          >
                            <Ban className="w-3 h-3" /> Revoked
                          </span>
                        )}
                      </td>

                      {/* Issued Date */}
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {new Date(cert.issuedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Action Menu */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {/* Download / View Button */}
                          <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener"
                            className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-white/5 transition"
                            title="View / Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>

                          {/* Reissue Button */}
                          <button
                            type="button"
                            onClick={() => setReissuingCert(cert)}
                            className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-white/5 transition"
                            title="Reissue Certificate"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Revoke Button (only active if currently ISSUED) */}
                          {isIssued && (
                            <button
                              type="button"
                              onClick={() => setRevokingCert(cert)}
                              className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition"
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
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <span className="text-xs text-slate-400">
                Page {page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-2 rounded-xl border border-white/10 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-2 rounded-xl border border-white/10 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5"
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
    </div>
  );
}
