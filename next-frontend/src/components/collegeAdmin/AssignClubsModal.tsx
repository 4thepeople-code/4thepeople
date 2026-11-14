'use client';

import { useEffect, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { useAdminClubsQuery } from '@/lib/api/admin';
import { useDepartment, useReplaceDepartmentClubsMutation } from '@/lib/api/departments';
import type { Department } from '@/types/models';
import Modal from '@/components/dashboard/ui/Modal';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import { Input } from '@/components/dashboard/ui/Field';
import { SkeletonLines } from '@/components/dashboard/ui/Skeleton';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, collegeAdmin } from '@/lib/copy';

export interface AssignClubsModalProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
  department: Department | null;
  onSuccess?: () => void;
}

/**
 * Assign Departmental clubs to one Department (replaced atomically). Central
 * clubs are excluded — they belong to no Department. Same hooks as before.
 */
export default function AssignClubsModal({
  slug,
  isOpen,
  onClose,
  department,
  onSuccess,
}: AssignClubsModalProps) {
  const t = collegeAdmin.assignClubs;
  const { toast } = useToast();
  const [selectedClubIds, setSelectedClubIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: deptDetail, isLoading: deptLoading } = useDepartment(
    slug,
    department?.id || '',
  );
  const { data: allClubs = [], isLoading: clubsLoading } = useAdminClubsQuery(slug, isOpen);
  const replaceMutation = useReplaceDepartmentClubsMutation(slug);

  const loadingData = deptLoading || clubsLoading;

  useEffect(() => {
    if (isOpen && department) {
      const existingClubs = deptDetail?.clubs || department.clubs || [];
      setSelectedClubIds(existingClubs.map((c) => c.id));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, department, deptDetail]);

  if (!department) return null;

  // Central clubs belong to no Department and can't be assigned here.
  const eligibleClubs = allClubs.filter((c) => !c.clubType || c.clubType !== 'CENTRAL');

  const filteredClubs = eligibleClubs.filter((c) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.description && c.description.toLowerCase().includes(term))
    );
  });

  const toggleGuarded = (fn: () => void) => {
    if (replaceMutation.isPending) return;
    setError(null);
    fn();
  };

  const handleToggleClub = (clubId: string) =>
    toggleGuarded(() => {
      setSelectedClubIds(
        selectedClubIds.includes(clubId)
          ? selectedClubIds.filter((id) => id !== clubId)
          : [...selectedClubIds, clubId],
      );
    });

  const handleSelectAll = () =>
    toggleGuarded(() => {
      const filteredIds = filteredClubs.map((c) => c.id);
      setSelectedClubIds(Array.from(new Set([...selectedClubIds, ...filteredIds])));
    });

  const handleClearAll = () => toggleGuarded(() => setSelectedClubIds([]));

  const handleClose = () => {
    if (replaceMutation.isPending) return;
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (replaceMutation.isPending) return;
    setError(null);

    try {
      await replaceMutation.mutateAsync({
        departmentId: department.id,
        clubIds: selectedClubIds,
      });
      onSuccess?.();
      onClose();
      toast(t.toastSaved(department.name), { variant: 'success' });
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(serverMessage || t.errSave);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title={t.title(department.shortCode || department.name)}
      description={t.description}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-[var(--secondary-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--secondary)]"
          >
            {error}
          </p>
        )}

        {loadingData ? (
          <div role="status" aria-label={t.loadingLabel}>
            <SkeletonLines count={4} />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-soft)]"
              />
              <Input
                type="search"
                aria-label={t.searchPlaceholder}
                placeholder={t.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <p className="flex items-center justify-between px-1 text-xs text-[var(--ink-soft)]">
              <span>{t.selectedCount(selectedClubIds.length)}</span>
              <span className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="min-h-8 rounded px-1 font-semibold text-[var(--primary)] underline-offset-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
                >
                  {t.selectAll}
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="min-h-8 rounded px-1 font-semibold text-[var(--secondary)] underline-offset-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
                >
                  {t.clear}
                </button>
              </span>
            </p>

            <div className="max-h-60 divide-y divide-[var(--line)] overflow-y-auto rounded-2xl border border-[var(--line)]">
              {filteredClubs.length === 0 ? (
                <p className="px-3.5 py-6 text-center text-xs text-[var(--ink-soft)]">
                  {t.noMatches}
                </p>
              ) : (
                filteredClubs.map((club) => {
                  const isSelected = selectedClubIds.includes(club.id);
                  return (
                    <label
                      key={club.id}
                      className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 transition-colors duration-150 motion-reduce:transition-none hover:bg-[var(--primary-soft)]/40 has-[:checked]:bg-[var(--primary-soft)]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-[var(--ink)]">
                          {club.name}
                        </span>
                        {club.description && (
                          <span className="block truncate text-[11px] text-[var(--ink-soft)]">
                            {club.description}
                          </span>
                        )}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                          isSelected
                            ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]'
                            : 'border-[var(--line)] bg-[var(--surface)]'
                        }`}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isSelected}
                        onChange={() => handleToggleClub(club.id)}
                      />
                    </label>
                  );
                })
              )}
            </div>

            <p className="text-xs italic text-[var(--ink-soft)]">{t.centralExcluded}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
          <DashboardButton
            variant="secondary"
            size="sm"
            onClick={handleClose}
            disabled={replaceMutation.isPending}
          >
            {actions.cancel}
          </DashboardButton>
          <DashboardButton
            type="submit"
            size="sm"
            loading={replaceMutation.isPending}
            loadingLabel={t.save}
            disabled={loadingData}
          >
            {t.save}
          </DashboardButton>
        </div>
      </form>
    </Modal>
  );
}
