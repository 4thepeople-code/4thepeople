'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, Building2, AlignLeft, PlusCircle } from 'lucide-react';
import { useCreateAdminClubMutation } from '@/lib/api/admin';
import { useDepartments, useReplaceClubDepartmentsMutation } from '@/lib/api/departments';
import AdminLayout from '@/components/admin/AdminLayout';
import MultiSelect from '@/components/admin/MultiSelect';

export interface CollegeAdminCreateClubClientProps {
  slug: string;
}

export function CollegeAdminCreateClubClient({ slug }: CollegeAdminCreateClubClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCentral, setIsCentral] = useState(false);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const getCanonicalPath = (subPath: string) => {
    if (pathname.startsWith(`/college/${slug}`)) {
      return `/college/${slug}${subPath}`;
    }
    return subPath;
  };

  const { data: departments = [] } = useDepartments(slug);
  const createClubMutation = useCreateAdminClubMutation(slug);
  const replaceClubDeptMutation = useReplaceClubDepartmentsMutation(slug);

  const departmentOptions = departments.map((d) => ({
    value: d.id,
    label: d.name,
    badge: d.shortCode,
  }));

  const handleCentralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsCentral(checked);
    if (checked) {
      setSelectedDepartmentIds([]);
    }
  };

  const isSubmitting = createClubMutation.isPending || replaceClubDeptMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Club name is required.');
      return;
    }

    try {
      const res = await createClubMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        isCentral,
      });

      const resObj = res as { data?: { id?: string; club?: { id?: string } }; id?: string; club?: { id?: string } };
      const newClubId = resObj.data?.id || resObj.data?.club?.id || resObj.id || resObj.club?.id;

      if (!isCentral && selectedDepartmentIds.length > 0 && newClubId) {
        await replaceClubDeptMutation.mutateAsync({
          clubId: newClubId,
          departmentIds: selectedDepartmentIds,
        });
      }

      if (newClubId) {
        router.push(getCanonicalPath(`/admin/clubs/${newClubId}`));
      } else {
        router.push(getCanonicalPath('/admin/clubs'));
      }
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errObj.response?.data?.message || 'Failed to create club. Please try again.');
    }
  };

  return (
    <AdminLayout slug={slug}>
      <div className="space-y-6 max-w-3xl mx-auto font-sans">
        {/* Navigation Header */}
        <div className="flex items-center gap-4 border-b border-[#E7E5E4] dark:border-[#2D2C30] pb-5">
          <Link
            href={getCanonicalPath('/admin/clubs')}
            className="p-2 bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] hover:bg-[#FAF9F7] dark:hover:bg-[#252429] text-[#6B6966] dark:text-[#A8A5A0] hover:text-[#1C1B1F] dark:hover:text-[#F5F3EF] rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#1C1B1F] dark:text-[#F5F3EF] tracking-tight">
              Create New Club
            </h1>
            <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0]">Establish a new recognized campus organization</p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 text-[#8B3A3A] dark:text-rose-300 rounded text-xs leading-relaxed">
            {errorMessage}
          </div>
        )}

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg p-6 space-y-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        >
          <div>
            <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1.5">
              Club Name <span className="text-[#8B3A3A]">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-[#8E8B85] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="e.g. IEEE Student Branch"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-[#1C1B1F] dark:text-[#F5F3EF] text-sm placeholder-[#A8A5A0] focus:outline-none transition-colors disabled:bg-[#F7F6F2] dark:disabled:bg-[#252429]"
              />
            </div>
          </div>

          {/* Central Club Option */}
          <div className="p-4 bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg space-y-2">
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
                  Central club (Institution-wide / no department)
                </span>
                <p className="text-[11px] text-[#8E8B85] mt-0.5">
                  Central clubs represent the university or college at large and are not attached to any single academic department.
                </p>
              </div>
            </label>
          </div>

          {/* Departments Multi-Select */}
          <div>
            <MultiSelect
              label="Department Affiliation"
              options={departmentOptions}
              selectedValues={selectedDepartmentIds}
              onChange={setSelectedDepartmentIds}
              disabled={isCentral || isSubmitting}
              disabledNote="Central clubs belong to no department."
              placeholder={isCentral ? 'Disabled for central clubs' : 'Select one or more academic departments...'}
              searchPlaceholder="Search departments..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1.5">
              Description
            </label>
            <div className="relative">
              <AlignLeft className="w-4 h-4 text-[#8E8B85] absolute left-3 top-3" />
              <textarea
                rows={4}
                placeholder="Provide a brief overview of the club's purpose, mission, and activities..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-[#1C1B1F] dark:text-[#F5F3EF] text-sm placeholder-[#A8A5A0] focus:outline-none transition-colors resize-none disabled:bg-[#F7F6F2] dark:disabled:bg-[#252429]"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#E7E5E4] dark:border-[#2D2C30]">
            <Link
              href={getCanonicalPath('/admin/clubs')}
              className="px-4 py-2 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <PlusCircle className="w-3.5 h-3.5" />
              )}
              <span>{isSubmitting ? 'Creating Club...' : 'Create Club'}</span>
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}

export default CollegeAdminCreateClubClient;
