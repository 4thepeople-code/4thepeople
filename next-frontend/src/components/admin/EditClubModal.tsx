'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Building2, Upload, Trash2 } from 'lucide-react';
import {
  useUpdateAdminClubMutation,
  useUploadClubLogoMutation,
  useDeleteClubLogoMutation,
} from '@/lib/api/admin';
import { useDepartments, useReplaceClubDepartmentsMutation } from '@/lib/api/departments';
import MultiSelect from './MultiSelect';
import type { Club } from '@/types/models';

export interface EditClubModalProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  club: Club | null;
}

export function EditClubModal({
  slug,
  isOpen,
  onClose,
  onSuccess,
  club,
}: EditClubModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCentral, setIsCentral] = useState(false);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

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
      const currentDeptIds = Array.isArray(club.departments)
        ? club.departments.map((d) => d.id || '')
        : [];
      setSelectedDepartmentIds(currentDeptIds.filter(Boolean));
      setError('');
    }
  }, [club, isOpen]);

  if (!isOpen || !club) return null;

  const handleCentralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsCentral(checked);
    if (checked) {
      setSelectedDepartmentIds([]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleDeleteLogo = async () => {
    setError('');
    try {
      await deleteLogoMutation.mutateAsync(club.id);
      setExistingLogoUrl(null);
      setLogoFile(null);
      setLogoPreview(null);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setError(errObj.response?.data?.message || 'Failed to remove club logo');
    }
  };

  const isSubmitting =
    updateClubMutation.isPending ||
    uploadLogoMutation.isPending ||
    deleteLogoMutation.isPending ||
    replaceClubDeptMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    if (!name.trim()) {
      setError('Club name is required.');
      return;
    }

    try {
      // 1. Update Club details
      await updateClubMutation.mutateAsync({
        clubId: club.id,
        data: {
          name: name.trim(),
          description: description.trim() || null,
          clubType: isCentral ? 'CENTRAL' : 'DEPARTMENTAL',
          isCentral,
        },
      });

      // 2. Upload Logo if provided
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        await uploadLogoMutation.mutateAsync({ clubId: club.id, formData });
      }

      // 3. Update Department links
      if (!isCentral) {
        await replaceClubDeptMutation.mutateAsync({
          clubId: club.id,
          departmentIds: selectedDepartmentIds,
        });
      } else {
        await replaceClubDeptMutation.mutateAsync({
          clubId: club.id,
          departmentIds: [],
        });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setError(errObj.response?.data?.message || 'Failed to update club details.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
      <div
        className="fixed inset-0 bg-[#1C1B1F]/50 backdrop-blur-xs transition-opacity"
        onClick={isSubmitting ? undefined : onClose}
      />

      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg shadow-lg overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 sm:p-6 pb-4 border-b border-[#E7E5E4] dark:border-[#2D2C30] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] text-[#B08D57] rounded">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif">Edit Club Details</h3>
              <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0]">Update name, description, branding, and departments</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-[#8E8B85] hover:text-[#1C1B1F] dark:hover:text-[#F5F3EF] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
            {error && (
              <div className="p-3 bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 rounded text-xs text-[#8B3A3A] dark:text-rose-300">
                {error}
              </div>
            )}

            {/* Logo Section */}
            <div>
              <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-2">
                Club Logo
              </label>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo Preview"
                    className="w-14 h-14 rounded object-cover border border-[#E7E5E4] dark:border-[#2D2C30]"
                  />
                ) : existingLogoUrl ? (
                  <img
                    src={existingLogoUrl}
                    alt={club.name}
                    className="w-14 h-14 rounded object-cover border border-[#E7E5E4] dark:border-[#2D2C30]"
                  />
                ) : (
                  <div className="w-14 h-14 rounded bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] flex items-center justify-center text-[#B08D57] font-serif text-xl font-semibold">
                    {club.name?.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{logoFile ? 'Change File' : 'Upload Logo'}</span>
                    </button>
                    {(existingLogoUrl || logoFile) && (
                      <button
                        type="button"
                        onClick={handleDeleteLogo}
                        disabled={deleteLogoMutation.isPending}
                        className="px-3 py-1.5 bg-[#FDF2F2] dark:bg-rose-950/40 hover:bg-[#F9E2E2] text-[#8B3A3A] dark:text-rose-400 text-xs font-medium rounded border border-[#F3CECE] dark:border-rose-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <p className="text-[11px] text-[#8E8B85]">PNG, JPG, or WEBP up to 5MB</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1.5">
                Club Name <span className="text-[#8B3A3A]">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-[#1C1B1F] dark:text-[#F5F3EF] placeholder-[#A8A5A0] text-sm focus:outline-none transition-colors"
              />
            </div>

            {/* Central Club Toggle */}
            <div className="p-3.5 bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isCentral}
                  onChange={handleCentralChange}
                  disabled={isSubmitting}
                  className="mt-0.5 w-4 h-4 text-[#B08D57] border-[#D8D7DC] rounded accent-[#B08D57]"
                />
                <div>
                  <span className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                    Central Club (Institution-wide / No department)
                  </span>
                  <p className="text-[11px] text-[#8E8B85] mt-0.5">
                    Central clubs represent the whole campus and are not attached to any single department.
                  </p>
                </div>
              </label>
            </div>

            {/* Department MultiSelect */}
            <div>
              <MultiSelect
                label="Department Affiliation"
                options={departmentOptions}
                selectedValues={selectedDepartmentIds}
                onChange={setSelectedDepartmentIds}
                disabled={isCentral || isSubmitting}
                disabledNote="Central clubs have no department affiliation."
                placeholder={isCentral ? 'Disabled for central clubs' : 'Select departments...'}
                searchPlaceholder="Search departments..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1.5">
                Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-[#1C1B1F] dark:text-[#F5F3EF] placeholder-[#A8A5A0] text-sm focus:outline-none transition-colors resize-none"
              />
            </div>
          </div>

          <div className="p-4 sm:p-6 pt-3 border-t border-[#E7E5E4] dark:border-[#2D2C30] bg-[#FAF9F7]/50 dark:bg-[#252429]/50 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting && (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditClubModal;
