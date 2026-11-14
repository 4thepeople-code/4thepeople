'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import {
  useUpdateAdminClubMutation,
  useUploadClubLogoMutation,
  useDeleteClubLogoMutation,
} from '@/lib/api/admin';
import { useDepartments, useReplaceClubDepartmentsMutation } from '@/lib/api/departments';
import type { Club } from '@/types/models';
import Modal from '@/components/dashboard/ui/Modal';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Field, { Input, Textarea } from '@/components/dashboard/ui/Field';
import Switch from '@/components/dashboard/ui/Switch';
import MultiSelect from '@/components/dashboard/ui/MultiSelect';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, collegeAdmin } from '@/lib/copy';

export interface EditClubModalProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  club: Club | null;
}

/**
 * Edit a club: details, optional logo upload/removal, and Department
 * affiliations (replaced atomically). Same hooks and the same three-step
 * submit sequence as before (update -> logo -> departments).
 */
export default function EditClubModal({ slug, isOpen, onClose, onSuccess, club }: EditClubModalProps) {
  const t = collegeAdmin.clubDetail;
  const tc = collegeAdmin.createClub;
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCentral, setIsCentral] = useState(false);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: departments = [] } = useDepartments(slug);
  const updateClubMutation = useUpdateAdminClubMutation(slug);
  const uploadLogoMutation = useUploadClubLogoMutation(slug);
  const deleteLogoMutation = useDeleteClubLogoMutation(slug);
  const replaceClubDeptMutation = useReplaceClubDepartmentsMutation(slug);

  const departmentOptions = departments.map((d) => ({
    value: d.id,
    label: d.name,
    badge: d.shortCode,
  }));

  useEffect(() => {
    if (club) {
      setName(club.name || '');
      setDescription(club.description || '');
      setExistingLogoUrl(club.logo?.url || club.logoUrl || null);
      setLogoFile(null);
      setLogoPreview(null);
      setIsCentral(Boolean(club.isCentral || club.clubType === 'CENTRAL'));
      const currentDeptIds = Array.isArray(club.departments) ? club.departments.map((d) => d.id || '') : [];
      setSelectedDepartmentIds(currentDeptIds.filter(Boolean));
      setError(null);
    }
  }, [club, isOpen]);

  const isSubmitting =
    updateClubMutation.isPending ||
    uploadLogoMutation.isPending ||
    deleteLogoMutation.isPending ||
    replaceClubDeptMutation.isPending;

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleCentralChange = (checked: boolean) => {
    setIsCentral(checked);
    if (checked) setSelectedDepartmentIds([]);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError(t.errImage);
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleDeleteLogo = async () => {
    if (!club) return;
    setError(null);
    try {
      await deleteLogoMutation.mutateAsync(club.id);
      setExistingLogoUrl(null);
      setLogoFile(null);
      setLogoPreview(null);
      onSuccess?.();
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(serverMessage || t.errLogoRemove);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || !club) return;
    setError(null);

    if (!name.trim()) {
      setError(t.errNameRequired);
      return;
    }

    try {
      // 1. Update club details
      await updateClubMutation.mutateAsync({
        clubId: club.id,
        data: {
          name: name.trim(),
          description: description.trim() || null,
          clubType: isCentral ? 'CENTRAL' : 'DEPARTMENTAL',
          isCentral,
        },
      });

      // 2. Upload the new logo, if one was picked
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        await uploadLogoMutation.mutateAsync({ clubId: club.id, formData });
      }

      // 3. Replace Department links (central clubs have none)
      await replaceClubDeptMutation.mutateAsync({
        clubId: club.id,
        departmentIds: isCentral ? [] : selectedDepartmentIds,
      });

      onSuccess?.();
      onClose();
      toast(t.toastSaved, { variant: 'success' });
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(serverMessage || t.errSave);
    }
  };

  return (
    <Modal open={isOpen && Boolean(club)} onClose={handleClose} title={t.editTitle} description={t.editDescription} size="lg">
      {club && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Logo */}
          <Field label={t.logoLabel} htmlFor="edit-club-logo-file">
            <div className="flex items-center gap-4">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview}
                  alt=""
                  className="h-14 w-14 rounded-xl border border-[var(--line)] object-cover"
                />
              ) : existingLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={existingLogoUrl}
                  alt={club.name}
                  className="h-14 w-14 rounded-xl border border-[var(--line)] object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid h-14 w-14 place-items-center rounded-xl border border-[var(--line)] bg-[var(--bg)] font-display text-xl font-bold text-[var(--primary)]"
                >
                  {club.name?.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <DashboardButton
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    leftIcon={<Upload aria-hidden="true" className="h-4 w-4" />}
                  >
                    {logoFile ? t.changeFile : t.uploadLogo}
                  </DashboardButton>
                  {(existingLogoUrl || logoFile) && (
                    <DashboardButton
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleDeleteLogo()}
                      loading={deleteLogoMutation.isPending}
                      loadingLabel={t.removeLogo}
                      disabled={isSubmitting && !deleteLogoMutation.isPending}
                      leftIcon={deleteLogoMutation.isPending ? undefined : <Trash2 aria-hidden="true" className="h-4 w-4" />}
                    >
                      {t.removeLogo}
                    </DashboardButton>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  id="edit-club-logo-file"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                <p className="text-xs text-[var(--ink-soft)]">{t.logoHint}</p>
              </div>
            </div>
          </Field>

          <Field label={t.formName} htmlFor="edit-club-name" required>
            <Input
              id="edit-club-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </Field>

          {/* Central toggle (reversible in-form; clears departments when on) */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
            <div className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-sm font-bold text-[var(--ink)]">{tc.centralToggle}</span>
                <span className="mt-0.5 block text-xs text-[var(--ink-soft)]">{tc.centralHint}</span>
              </span>
              <Switch
                checked={isCentral}
                onChange={handleCentralChange}
                label={tc.centralToggle}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <MultiSelect
            label={tc.departmentsLabel}
            options={departmentOptions}
            selectedValues={selectedDepartmentIds}
            onChange={setSelectedDepartmentIds}
            disabled={isCentral || isSubmitting}
            disabledNote={tc.multiSelectDisabled}
            placeholder={isCentral ? tc.multiSelectDisabled : tc.multiSelectPlaceholder}
            searchPlaceholder={collegeAdmin.departments.searchPlaceholder}
          />

          <Field label={t.formDescription} htmlFor="edit-club-description">
            <Textarea
              id="edit-club-description"
              rows={3}
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
            <DashboardButton type="submit" size="sm" loading={isSubmitting} loadingLabel={t.submitSave}>
              {t.submitSave}
            </DashboardButton>
          </div>
        </form>
      )}
    </Modal>
  );
}
