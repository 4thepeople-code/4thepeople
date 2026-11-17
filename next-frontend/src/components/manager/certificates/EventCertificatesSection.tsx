'use client';

import React, { useState } from 'react';
import {
  useEventCertificatesQuery,
  useEligibleStudentsQuery,
} from '@/lib/api/manager';
import { IndividualUploadModal } from './IndividualUploadModal';
import { BulkUploadModal } from './BulkUploadModal';
import { TemplateGenerationModal } from './TemplateGenerationModal';
import { RevokeCertificateModal } from './RevokeCertificateModal';
import { ReissueCertificateModal } from './ReissueCertificateModal';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import { SkeletonCard } from '@/components/dashboard/ui/Skeleton';
import { actions, managerCertificates } from '@/lib/copy';
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
  AlertCircle,
} from 'lucide-react';
import type { EventCertificate } from '@/types/models';

interface EventCertificatesSectionProps {
  slug: string;
  clubId?: string;
  eventId: string;
  eventTitle?: string;
}

const t = managerCertificates.section;

export function EventCertificatesSection({
  slug,
  eventId,
  eventTitle,
}: EventCertificatesSectionProps) {
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
    isError: certsError,
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

  const methodLabel = (source: EventCertificate['source']) =>
    source === 'INDIVIDUAL_UPLOAD' ? t.methodIndividual : source === 'BULK_UPLOAD' ? t.methodBulk : t.methodGenerated;

  const statusChip = (cert: EventCertificate) =>
    cert.status === 'ISSUED' ? (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
        <CheckCircle2 aria-hidden="true" className="h-3 w-3" /> {t.statusIssued}
      </span>
    ) : (
      <span
        className="inline-flex cursor-help items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700"
        title={cert.revocationReason || t.revokedReasonFallback}
      >
        <Ban aria-hidden="true" className="h-3 w-3" /> {t.statusRevoked}
      </span>
    );

  const coverage =
    eligibleStudents.length > 0
      ? Math.round(
          (eligibleStudents.filter((s) => s.hasActiveCertificate).length / eligibleStudents.length) * 100,
        )
      : 0;

  const statTile = (label: string, value: React.ReactNode, unit: string, valueClass = 'text-[var(--ink)]') => (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">{label}</span>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-2xl font-black ${valueClass}`}>{value}</span>
        <span className="text-xs text-[var(--ink-soft)]">{unit}</span>
      </div>
    </div>
  );

  // One row's action buttons — shared by the table and the stacked mobile cards.
  const certActions = (cert: EventCertificate) => {
    const isIssued = cert.status === 'ISSUED';
    const downloadUrl = `/api/manager/events/${eventId}/certificates/${cert.id}/download?college=${slug}`;
    return (
      <div className="inline-flex items-center justify-end gap-1.5">
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--line)] text-[var(--ink-soft)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          title={t.viewPdf}
          aria-label={`${t.viewPdf} — ${cert.user?.name || ''}`}
        >
          <Download aria-hidden="true" className="h-3.5 w-3.5" />
        </a>

        <button
          type="button"
          onClick={() => setReissuingCert(cert)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--line)] text-[var(--ink-soft)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          title={t.reissueAction}
          aria-label={`${t.reissueAction} — ${cert.user?.name || ''}`}
        >
          <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
        </button>

        {isIssued && (
          <button
            type="button"
            onClick={() => setRevokingCert(cert)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--line)] text-[var(--ink-soft)] transition-colors hover:border-[var(--secondary)] hover:bg-[var(--secondary-soft)] hover:text-[var(--secondary)] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            title={t.revokeAction}
            aria-label={`${t.revokeAction} — ${cert.user?.name || ''}`}
          >
            <Ban aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  const certNumberCell = (cert: EventCertificate) => (
    <div className="inline-flex items-center gap-1.5">
      <span className="font-mono text-xs font-medium text-[var(--ink)]">{cert.certificateNumber}</span>
      <button
        type="button"
        onClick={() => handleCopyNumber(cert.certificateNumber)}
        className="grid h-7 w-7 place-items-center rounded-md text-[var(--ink-soft)] transition-colors hover:bg-[var(--primary-soft)] hover:text-[var(--ink)] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        title={t.copyNumber}
        aria-label={`${t.copyNumber} ${cert.certificateNumber}`}
      >
        {copiedCertId === cert.certificateNumber ? (
          <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Copy aria-hidden="true" className="h-3.5 w-3.5" />
        )}
      </button>
      {copiedCertId === cert.certificateNumber && (
        <span role="status" className="text-[10px] font-bold text-emerald-700">
          {t.copied}
        </span>
      )}
    </div>
  );

  const recipientCell = (cert: EventCertificate) => (
    <div className="flex items-center gap-3">
      {cert.user?.avatar?.url ? (
        <img
          src={cert.user.avatar.url}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full border border-[var(--line)] object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] text-xs font-bold uppercase text-[var(--primary)]"
        >
          {(cert.user?.name || 'S').slice(0, 2)}
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate text-xs font-bold text-[var(--ink)]">{cert.user?.name || t.fallbackStudent}</div>
        <div className="truncate text-[11px] text-[var(--ink-soft)]">
          {cert.user?.rollNumber || t.noRoll} • {cert.user?.email || t.noEmail}
        </div>
      </div>
    </div>
  );

  const issuedAtCell = (cert: EventCertificate) =>
    new Date(cert.issuedAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <div className="space-y-6 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
      {/* Section Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--primary)]/20 bg-[var(--primary-soft)] text-[var(--primary)]"
            >
              <Award className="h-4 w-4" />
            </span>
            <h2 className="font-display text-lg font-bold tracking-tight text-[var(--ink)]">{t.title}</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">{t.description}</p>
        </div>

        {/* Issuance Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <DashboardButton variant="secondary" size="sm" leftIcon={<Upload aria-hidden="true" className="h-3.5 w-3.5" />} onClick={() => setIsIndividualModalOpen(true)}>
            {t.actionIndividual}
          </DashboardButton>
          <DashboardButton variant="secondary" size="sm" leftIcon={<Archive aria-hidden="true" className="h-3.5 w-3.5" />} onClick={() => setIsBulkModalOpen(true)}>
            {t.actionBulk}
          </DashboardButton>
          <DashboardButton variant="primary" size="sm" leftIcon={<Sparkles aria-hidden="true" className="h-3.5 w-3.5" />} onClick={() => setIsTemplateModalOpen(true)}>
            {t.actionGenerate}
          </DashboardButton>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {statTile(t.statIssued, pagination.total, t.statIssuedUnit)}
        {statTile(t.statEligible, eligibleStudents.length, t.statEligibleUnit, 'text-[var(--primary)]')}
        {statTile(t.statCoverage, `${coverage}%`, t.statCoverageUnit, 'text-emerald-700')}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col items-stretch justify-between gap-3 pt-2 sm:flex-row sm:items-center">
        {/* Status Tabs */}
        <div className="inline-flex self-start rounded-xl border border-[var(--line)] bg-[var(--bg)] p-1" role="group" aria-label={t.tableStatus}>
          {(['ALL', 'ISSUED', 'REVOKED'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setStatusFilter(tab);
                setPage(1);
              }}
              aria-pressed={statusFilter === tab}
              className={`min-h-8 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                statusFilter === tab
                  ? 'bg-[var(--primary)] text-[var(--on-primary)]'
                  : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              {tab === 'ALL' ? t.filterAll : tab === 'ISSUED' ? t.filterIssued : t.filterRevoked}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <label htmlFor="certificates-search" className="sr-only">
            {t.searchLabel}
          </label>
          <Search aria-hidden="true" className="absolute left-3 top-2.5 h-4 w-4 text-[var(--ink-soft)]" />
          <input
            id="certificates-search"
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] py-2 pl-9 pr-3 text-xs text-[var(--ink)] placeholder:text-[var(--ink-soft)] transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
          />
        </div>
      </div>

      {/* Certificates: five states */}
      {certsLoading ? (
        /* Loading state */
        <div className="space-y-3" role="status" aria-label={t.loadingLabel}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : certsError ? (
        /* Error state with retry */
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-6 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--ink-soft)]">
            <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--secondary)]" />
            {t.errLoad}
          </p>
          <DashboardButton variant="primary" size="sm" onClick={handleRefresh} leftIcon={<RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />}>
            {actions.retry}
          </DashboardButton>
        </div>
      ) : certificates.length === 0 ? (
        /* Empty state */
        pagination.total === 0 && statusFilter === 'ALL' && !searchQuery.trim() ? (
          <EmptyState
            icon={Award}
            title={t.emptyTitle}
            description={t.emptyDescription}
            actionLabel={t.actionGenerate}
            onAction={() => setIsTemplateModalOpen(true)}
          />
        ) : (
          <EmptyState icon={Search} title={t.emptyFilteredTitle} description={t.emptyFilteredDescription} />
        )
      ) : (
        /* Success state: table on sm+, stacked cards below sm */
        <div className="space-y-4">
          {/* Stacked cards (mobile) */}
          <ul className="space-y-3 sm:hidden">
            {certificates.map((cert) => (
              <li key={cert.id} className="space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
                {recipientCell(cert)}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {certNumberCell(cert)}
                  {statusChip(cert)}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--ink-soft)]">
                  <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] font-semibold">
                    {methodLabel(cert.source)}
                  </span>
                  <span>{issuedAtCell(cert)}</span>
                </div>
                <div className="flex justify-end border-t border-dashed border-[var(--line)] pt-3">{certActions(cert)}</div>
              </li>
            ))}
          </ul>

          {/* Table (sm+) */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--line)] text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                  <th className="px-4 py-3">{t.tableRecipient}</th>
                  <th className="px-4 py-3">{t.tableNumber}</th>
                  <th className="px-4 py-3">{t.tableMethod}</th>
                  <th className="px-4 py-3">{t.tableStatus}</th>
                  <th className="px-4 py-3">{t.tableIssuedAt}</th>
                  <th className="px-4 py-3 text-right">{t.tableActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {certificates.map((cert) => (
                  <tr key={cert.id} className="transition-colors hover:bg-[var(--primary-soft)]/30 motion-reduce:transition-none">
                    <td className="px-4 py-3">{recipientCell(cert)}</td>
                    <td className="px-4 py-3">{certNumberCell(cert)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-soft)]">
                        {methodLabel(cert.source)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{statusChip(cert)}</td>
                    <td className="px-4 py-3 text-[11px] text-[var(--ink-soft)]">{issuedAtCell(cert)}</td>
                    <td className="px-4 py-3 text-right">{certActions(cert)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination (disabled state at the bounds) */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
              <span className="text-xs text-[var(--ink-soft)]">
                {t.paginationInfo(page, pagination.totalPages, pagination.total)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label={t.prevPage}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] text-[var(--ink)] transition-colors hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label={t.nextPage}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] text-[var(--ink)] transition-colors hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <IndividualUploadModal
        open={isIndividualModalOpen}
        onClose={() => setIsIndividualModalOpen(false)}
        slug={slug}
        eventId={eventId}
        eventTitle={eventTitle}
        onSuccess={handleRefresh}
      />

      <BulkUploadModal
        open={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        slug={slug}
        eventId={eventId}
        onSuccess={handleRefresh}
      />

      <TemplateGenerationModal
        open={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        slug={slug}
        eventId={eventId}
        eventTitle={eventTitle}
        onSuccess={handleRefresh}
      />

      <RevokeCertificateModal
        open={Boolean(revokingCert)}
        onClose={() => setRevokingCert(null)}
        slug={slug}
        eventId={eventId}
        certificate={revokingCert}
        onSuccess={handleRefresh}
      />

      <ReissueCertificateModal
        open={Boolean(reissuingCert)}
        onClose={() => setReissuingCert(null)}
        slug={slug}
        eventId={eventId}
        certificate={reissuingCert}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
