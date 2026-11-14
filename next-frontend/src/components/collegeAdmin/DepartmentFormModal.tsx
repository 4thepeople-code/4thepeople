'use client';

import { useEffect, useState } from 'react';
import { useCreateDepartmentMutation, useUpdateDepartmentMutation } from '@/lib/api/departments';
import type { Department } from '@/types/models';
import Modal from '@/components/dashboard/ui/Modal';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Field, { Input, Textarea } from '@/components/dashboard/ui/Field';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, collegeAdmin } from '@/lib/copy';

export interface DepartmentFormModalProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
  /** Present = edit mode; absent = create. */
  department?: Department | null;
  onSuccess?: () => void;
}

/**
 * Create or edit a Department (name, short code, description). Same two
 * hooks as before; presentation only.
 */
export default function DepartmentFormModal({
  slug,
  isOpen,
  onClose,
  department = null,
  onSuccess,
}: DepartmentFormModalProps) {
  const t = collegeAdmin.departmentForm;
  const { toast } = useToast();
  const isEditing = Boolean(department?.id);

  const [name, setName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createDepartmentMutation = useCreateDepartmentMutation(slug);
  const updateDepartmentMutation = useUpdateDepartmentMutation(slug);
  const isSubmitting = createDepartmentMutation.isPending || updateDepartmentMutation.isPending;

  useEffect(() => {
    if (department) {
      setName(department.name || '');
      setShortCode(department.shortCode || department.code || '');
      setDescription(department.description || '');
    } else {
      setName('');
      setShortCode('');
      setDescription('');
    }
    setError(null);
  }, [department, isOpen]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (!name.trim()) {
      setError(t.errNameRequired);
      return;
    }
    if (!shortCode.trim()) {
      setError(t.errShortCodeRequired);
      return;
    }

    try {
      if (isEditing && department?.id) {
        await updateDepartmentMutation.mutateAsync({
          id: department.id,
          data: {
            name: name.trim(),
            shortCode: shortCode.trim().toUpperCase(),
            description: description.trim() || null,
          },
        });
        toast(t.toastSaved(name.trim()), { variant: 'success' });
      } else {
        await createDepartmentMutation.mutateAsync({
          name: name.trim(),
          shortCode: shortCode.trim().toUpperCase(),
          description: description.trim() || null,
        });
        toast(t.toastCreated(name.trim()), { variant: 'success' });
      }
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(serverMessage || (isEditing ? t.errUpdate : t.errCreate));
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title={isEditing ? t.editTitle : t.createTitle}
      description={isEditing ? t.editDescription : t.createDescription}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t.formName} htmlFor="department-name" required>
          <Input
            id="department-name"
            placeholder={t.formNamePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
          />
        </Field>

        <Field label={t.formShortCode} htmlFor="department-short-code" required hint={t.formShortCodeHint}>
          <Input
            id="department-short-code"
            placeholder={t.formShortCodePlaceholder}
            value={shortCode}
            onChange={(e) => setShortCode(e.target.value.toUpperCase())}
            disabled={isSubmitting}
            className="font-mono uppercase"
          />
        </Field>

        <Field label={t.formDescription} htmlFor="department-description">
          <Textarea
            id="department-description"
            rows={3}
            placeholder={t.formDescriptionPlaceholder}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
          />
        </Field>

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
            loadingLabel={isEditing ? t.submitSave : t.submitCreate}
            disabled={!name.trim() || !shortCode.trim()}
          >
            {isEditing ? t.submitSave : t.submitCreate}
          </DashboardButton>
        </div>
      </form>
    </Modal>
  );
}
