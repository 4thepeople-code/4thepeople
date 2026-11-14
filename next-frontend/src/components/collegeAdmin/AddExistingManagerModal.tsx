'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { useAllUsersQuery, useAddExistingManagerToClubMutation } from '@/lib/api/admin';
import Modal from '@/components/dashboard/ui/Modal';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import { Input } from '@/components/dashboard/ui/Field';
import EmptyState from '@/components/dashboard/ui/EmptyState';
import { SkeletonLines } from '@/components/dashboard/ui/Skeleton';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, collegeAdmin } from '@/lib/copy';

export interface AddExistingManagerModalProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  clubId: string;
  /** User IDs that already manage this club (hidden from the list). */
  existingManagerIds?: string[];
}

/**
 * Assign a registered, active account as Event Manager of one club. Same
 * hook as before; the list filters out inactive users and current managers.
 */
export default function AddExistingManagerModal({
  slug,
  isOpen,
  onClose,
  onSuccess,
  clubId,
  existingManagerIds = [],
}: AddExistingManagerModalProps) {
  const t = collegeAdmin.addExistingManager;
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: allUsers = [], isLoading: fetching } = useAllUsersQuery(slug, isOpen);
  const addManagerMutation = useAddExistingManagerToClubMutation(slug);

  const availableUsers = allUsers.filter(
    (u) => u.isActive && !existingManagerIds.includes(u.id),
  );

  const filteredUsers = availableUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const handleClose = () => {
    if (addManagerMutation.isPending) return;
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!selectedUserId) {
      setError(t.errSelect);
      return;
    }

    const selected = availableUsers.find((u) => u.id === selectedUserId);
    try {
      await addManagerMutation.mutateAsync({ clubId, userId: selectedUserId });
      onSuccess?.();
      onClose();
      toast(t.toastAssigned(selected?.name || ''), { variant: 'success' });
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(serverMessage || t.errAssign);
    }
  };

  return (
    <Modal open={isOpen} onClose={handleClose} title={t.title} description={t.description} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-[var(--secondary-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--secondary)]"
          >
            {error}
          </p>
        )}

        {fetching ? (
          <div role="status" aria-label={t.loadingLabel}>
            <SkeletonLines count={4} />
          </div>
        ) : availableUsers.length === 0 ? (
          <EmptyState title={t.empty} />
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <fieldset className="max-h-60 divide-y divide-[var(--line)] overflow-y-auto rounded-2xl border border-[var(--line)]">
              <legend className="sr-only">{t.title}</legend>
              {filteredUsers.length === 0 ? (
                <p className="px-3.5 py-6 text-center text-xs text-[var(--ink-soft)]">
                  {collegeAdmin.multiSelect.noMatches}
                </p>
              ) : (
                filteredUsers.map((u) => (
                <label
                  key={u.id}
                  className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 transition-colors duration-150 motion-reduce:transition-none hover:bg-[var(--primary-soft)]/40 has-[:checked]:bg-[var(--primary-soft)] has-[:checked]:font-semibold"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-[var(--ink)]">{u.name}</span>
                    <span className="block truncate font-mono text-[11px] text-[var(--ink-soft)]">{u.email}</span>
                  </span>
                  <input
                    type="radio"
                    name="add-existing-manager"
                    value={u.id}
                    checked={selectedUserId === u.id}
                    onChange={() => setSelectedUserId(u.id)}
                    className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                  />
                </label>
              ))
              )}
            </fieldset>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
          <DashboardButton variant="secondary" size="sm" onClick={handleClose} disabled={addManagerMutation.isPending}>
            {actions.cancel}
          </DashboardButton>
          <DashboardButton
            type="submit"
            size="sm"
            loading={addManagerMutation.isPending}
            loadingLabel={t.assign}
            disabled={!selectedUserId && !addManagerMutation.isPending}
          >
            {t.assign}
          </DashboardButton>
        </div>
      </form>
    </Modal>
  );
}
