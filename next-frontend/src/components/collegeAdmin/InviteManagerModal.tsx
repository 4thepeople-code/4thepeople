'use client';

import { useState } from 'react';
import {
  useCreateManagerMutation,
  useInviteManagerToClubMutation,
} from '@/lib/api/admin';
import Modal from '@/components/dashboard/ui/Modal';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Field, { Input } from '@/components/dashboard/ui/Field';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, collegeAdmin } from '@/lib/copy';

export interface InviteManagerModalProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
  /** Present when inviting into a specific club; absent for a global invite. */
  clubId?: string | null;
  onSuccess?: () => void;
}

/**
 * Invite an Event Manager: creates a fresh manager account, or (with
 * `clubId`) invites them straight into one club. Same two hooks as before —
 * presentation only.
 */
export default function InviteManagerModal({
  slug,
  isOpen,
  onClose,
  clubId = null,
  onSuccess,
}: InviteManagerModalProps) {
  const t = collegeAdmin.inviteManager;
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createManagerMutation = useCreateManagerMutation(slug);
  const inviteToClubMutation = useInviteManagerToClubMutation(slug);
  const isSubmitting = createManagerMutation.isPending || inviteToClubMutation.isPending;

  // Strict-enough shape check: something@something.tld. The server remains the
  // authority; this only gates the button and gives an inline message.
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const formIsValid = Boolean(name.trim()) && emailIsValid;

  const handleClose = () => {
    if (isSubmitting) return;
    setName('');
    setEmail('');
    setNameError(null);
    setEmailError(null);
    setError(null);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    // Inline validation: each field reports its own problem below its input.
    let invalid = false;
    if (!name.trim()) {
      setNameError(t.errName);
      invalid = true;
    }
    if (!email.trim()) {
      setEmailError(t.errEmailRequired);
      invalid = true;
    } else if (!emailIsValid) {
      setEmailError(t.errEmailInvalid);
      invalid = true;
    }
    if (invalid) return;

    try {
      if (clubId) {
        await inviteToClubMutation.mutateAsync({
          clubId,
          data: { name: name.trim(), email: email.trim().toLowerCase() },
        });
      } else {
        await createManagerMutation.mutateAsync({
          name: name.trim(),
          email: email.trim().toLowerCase(),
        });
      }
      setName('');
      setEmail('');
      setNameError(null);
      setEmailError(null);
      onSuccess?.();
      onClose();
      toast(t.toastSent, { variant: 'success' });
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(serverMessage || t.errSend);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title={clubId ? t.titleToClub : t.title}
      description={t.description}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.formName} htmlFor="invite-manager-name" required error={nameError ?? undefined}>
            <Input
              id="invite-manager-name"
              placeholder={t.formNamePlaceholder}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              disabled={isSubmitting}
              aria-invalid={nameError ? true : undefined}
              autoComplete="name"
            />
          </Field>
          <Field label={t.formEmail} htmlFor="invite-manager-email" required error={emailError ?? undefined}>
            <Input
              id="invite-manager-email"
              type="email"
              placeholder={t.formEmailPlaceholder}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              disabled={isSubmitting}
              aria-invalid={emailError ? true : undefined}
              autoComplete="email"
            />
          </Field>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-[var(--secondary-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--secondary)]"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
          <DashboardButton variant="secondary" size="sm" onClick={handleClose} disabled={isSubmitting}>
            {actions.cancel}
          </DashboardButton>
          <DashboardButton
            type="submit"
            size="sm"
            loading={isSubmitting}
            loadingLabel={t.submitting}
            disabled={!formIsValid && !isSubmitting}
          >
            {t.submit}
          </DashboardButton>
        </div>
      </form>
    </Modal>
  );
}
