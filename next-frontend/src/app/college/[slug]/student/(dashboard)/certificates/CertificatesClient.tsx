'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Award, Check, Copy, Download, ExternalLink, RefreshCw } from 'lucide-react';
import { useMyCertificatesQuery } from '@/lib/api/events';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Chip from '@/components/dashboard/ui/Chip';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import { SkeletonCard } from '@/components/dashboard/ui/Skeleton';
import { actions, emptyStates, student } from '@/lib/copy';

export interface CertificatesClientProps {
  slug: string;
}

/**
 * Student "My certificates": issued credentials with certificate number
 * (copy-to-clipboard), authenticated PDF download, and public verification
 * link. Same certificates API hook as before.
 */
export default function CertificatesClient({ slug }: CertificatesClientProps) {
  const t = student.certificates;

  const [copiedCertId, setCopiedCertId] = useState<string | null>(null);

  const {
    data: myCertificates = [],
    isLoading,
    isError,
    refetch,
  } = useMyCertificatesQuery(slug, true);

  const handleCopy = (certificateNumber: string) => {
    void navigator.clipboard.writeText(certificateNumber);
    setCopiedCertId(certificateNumber);
    window.setTimeout(() => setCopiedCertId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader role="student" title={t.title} description={t.description} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" role="status" aria-label={t.loadingLabel}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader role="student" title={t.title} description={t.description} />
        <EmptyState
          icon={Award}
          title={emptyStates.loadingFailed.title}
          description={t.errLoad}
          actionLabel={actions.retry}
          onAction={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        role="student"
        title={t.title}
        description={t.description}
        actions={
          <DashboardButton
            variant="secondary"
            size="sm"
            onClick={() => void refetch()}
            leftIcon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
          >
            {t.refresh}
          </DashboardButton>
        }
      />

      {myCertificates.length === 0 ? (
        <EmptyState
          icon={Award}
          title={t.emptyTitle}
          description={t.emptyDescription}
          actionLabel={t.emptyAction}
          actionHref={`/college/${slug}/student/events`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {myCertificates.map((cert) => {
            const downloadUrl = `/api/certificates/${cert.id}/download?college=${slug}`;
            const verifyUrl = `/college/${slug}/verify/${cert.certificateNumber}`;

            return (
              <div
                key={cert.id}
                className="flex flex-col justify-between gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm transition-colors duration-150 motion-reduce:transition-none hover:border-[var(--primary)]"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Chip variant="success" dot>
                      {t.official}
                    </Chip>
                    <span className="text-[11px] text-[var(--ink-soft)]">
                      {t.issued(
                        new Date(cert.issuedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }),
                      )}
                    </span>
                  </div>

                  <div>
                    <h3 className="line-clamp-1 font-display text-base font-bold tracking-tight text-[var(--ink)]">
                      {cert.event?.title || t.noEventTitle}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-[var(--ink-soft)]">
                      {cert.event?.club?.name || 'Campus event'}
                    </p>
                  </div>

                  {/* Certificate number with copy */}
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5">
                    <span className="truncate font-mono text-xs font-bold text-[var(--primary)]">
                      {cert.certificateNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(cert.certificateNumber)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--ink-soft)] transition-colors hover:bg-[var(--primary-soft)] hover:text-[var(--ink)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
                      aria-label={t.copyId}
                      title={t.copyId}
                    >
                      {copiedCertId === cert.certificateNumber ? (
                        <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-t border-[var(--line)] pt-3">
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener"
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)] transition-colors duration-150 hover:bg-[var(--primary-strong)] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                  >
                    <Download aria-hidden="true" className="h-4 w-4" />
                    {t.download}
                  </a>
                  <Link
                    href={verifyUrl}
                    target="_blank"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--line)] text-[var(--ink-soft)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
                    aria-label={t.verify}
                    title={t.verify}
                  >
                    <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
