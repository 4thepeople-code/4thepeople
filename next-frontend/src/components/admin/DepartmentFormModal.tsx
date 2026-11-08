'use client';

import React, { useState, useEffect } from 'react';
import { Building2, X, PlusCircle, Save } from 'lucide-react';
import {
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
} from '@/lib/api/departments';
import type { Department } from '@/types/models';

export interface DepartmentFormModalProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
  department?: Department | null;
  onSuccess?: () => void;
}

export function DepartmentFormModal({
  slug,
  isOpen,
  onClose,
  department = null,
  onSuccess,
}: DepartmentFormModalProps) {
  const isEditing = Boolean(department?.id);

  const [name, setName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

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
    setError('');
  }, [department, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    if (!name.trim()) {
      setError('Department name is required.');
      return;
    }

    if (!shortCode.trim()) {
      setError('Department short code is required.');
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
      } else {
        await createDepartmentMutation.mutateAsync({
          name: name.trim(),
          shortCode: shortCode.trim().toUpperCase(),
          description: description.trim() || null,
        });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setError(
        errObj.response?.data?.message ||
        `Failed to ${isEditing ? 'update' : 'create'} department.`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
      <div
        className="fixed inset-0 bg-[#1C1B1F]/50 backdrop-blur-xs transition-opacity"
        onClick={isSubmitting ? undefined : onClose}
      />

      <div className="relative w-full max-w-md max-h-[92vh] flex flex-col bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg shadow-lg overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 sm:p-6 pb-4 border-b border-[#E7E5E4] dark:border-[#2D2C30] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] text-[#B08D57] rounded">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif">
                {isEditing ? 'Edit Department' : 'Create Department'}
              </h3>
              <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0]">
                {isEditing
                  ? 'Update department details and short code'
                  : 'Add a new academic department to the institution'}
              </p>
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
          <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
            {error && (
              <div className="p-3 bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 rounded text-xs text-[#8B3A3A] dark:text-rose-300">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1.5">
                Department Name <span className="text-[#8B3A3A]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Computer Science & Engineering"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-[#1C1B1F] dark:text-[#F5F3EF] placeholder-[#A8A5A0] text-sm focus:outline-none transition-colors disabled:bg-[#F7F6F2] dark:disabled:bg-[#252429]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1.5">
                Short Code / Acronym <span className="text-[#8B3A3A]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. CSE"
                value={shortCode}
                onChange={(e) => setShortCode(e.target.value.toUpperCase())}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-[#1C1B1F] dark:text-[#F5F3EF] placeholder-[#A8A5A0] text-sm font-mono uppercase focus:outline-none transition-colors disabled:bg-[#F7F6F2] dark:disabled:bg-[#252429]"
              />
              <p className="mt-1 text-[11px] text-[#8E8B85]">
                Used for badges, filters, and student roster department mapping.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1.5">
                Description
              </label>
              <textarea
                rows={3}
                placeholder="Optional overview of this department..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-[#1C1B1F] dark:text-[#F5F3EF] placeholder-[#A8A5A0] text-sm focus:outline-none transition-colors resize-none disabled:bg-[#F7F6F2] dark:disabled:bg-[#252429]"
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
              disabled={isSubmitting || !name.trim() || !shortCode.trim()}
              className="px-4 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isEditing ? (
                <Save className="w-3.5 h-3.5" />
              ) : (
                <PlusCircle className="w-3.5 h-3.5" />
              )}
              {isEditing ? 'Save Changes' : 'Create Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DepartmentFormModal;

