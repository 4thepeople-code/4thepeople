'use client';

import Modal from './Modal';
import DashboardButton from './DashboardButton';
import { actions } from '@/lib/copy';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Names the object, e.g. "Reset 2FA for Priya?" */
  title: string;
  /** Names the consequence, e.g. what the person loses and how to recover. */
  children: React.ReactNode;
  confirmLabel: string;
  variant?: 'danger' | 'brand';
  loading?: boolean;
}

/**
 * Confirmation for irreversible actions only. Must name the object (in
 * `title`) and the consequence (in `children`) — see lib/copy.ts rules.
 * Reversible actions get a toggle + Undo toast instead of this dialog.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-5">
        <div className="text-sm leading-relaxed text-[var(--ink-soft)]">{children}</div>
        <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
          <DashboardButton variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            {actions.keep}
          </DashboardButton>
          <DashboardButton
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            loading={loading}
            loadingLabel={confirmLabel}
          >
            {confirmLabel}
          </DashboardButton>
        </div>
      </div>
    </Modal>
  );
}
