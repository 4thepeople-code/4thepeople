'use client';

import React, { useState, useEffect } from 'react';
import { Users, X, Search, Check, Save, Loader2 } from 'lucide-react';
import { useAdminClubsQuery } from '@/lib/api/admin';
import { useDepartment, useReplaceDepartmentClubsMutation } from '@/lib/api/departments';
import type { Department } from '@/types/models';

export interface AssignClubsModalProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
  department: Department | null;
  onSuccess?: () => void;
}

export function AssignClubsModal({
  slug,
  isOpen,
  onClose,
  department,
  onSuccess,
}: AssignClubsModalProps) {
  const [selectedClubIds, setSelectedClubIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  const { data: deptDetail, isLoading: deptLoading } = useDepartment(
    slug,
    department?.id || ''
  );
  const { data: allClubs = [], isLoading: clubsLoading } = useAdminClubsQuery(slug, isOpen);
  const replaceMutation = useReplaceDepartmentClubsMutation(slug);

  const loadingData = deptLoading || clubsLoading;

  useEffect(() => {
    if (isOpen && department) {
      const existingClubs = deptDetail?.clubs || department.clubs || [];
      setSelectedClubIds(existingClubs.map((c) => c.id));
      setError('');
    }
  }, [isOpen, department, deptDetail]);

  if (!isOpen || !department) return null;

  // Filter out central clubs per requirement (central clubs belong to no department)
  const eligibleClubs = allClubs.filter((c) => !c.clubType || c.clubType !== 'CENTRAL');

  const filteredClubs = eligibleClubs.filter((c) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.description && c.description.toLowerCase().includes(term))
    );
  });

  const handleToggleClub = (clubId: string) => {
    if (replaceMutation.isPending) return;
    if (selectedClubIds.includes(clubId)) {
      setSelectedClubIds(selectedClubIds.filter((id) => id !== clubId));
    } else {
      setSelectedClubIds([...selectedClubIds, clubId]);
    }
  };

  const handleSelectAll = () => {
    if (replaceMutation.isPending) return;
    const filteredIds = filteredClubs.map((c) => c.id);
    setSelectedClubIds(Array.from(new Set([...selectedClubIds, ...filteredIds])));
  };

  const handleClearAll = () => {
    if (replaceMutation.isPending) return;
    setSelectedClubIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (replaceMutation.isPending) return;
    setError('');

    try {
      await replaceMutation.mutateAsync({
        departmentId: department.id,
        clubIds: selectedClubIds,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setError(errObj.response?.data?.message || 'Failed to update department club assignments.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
      <div
        className="fixed inset-0 bg-[#1C1B1F]/50 backdrop-blur-xs transition-opacity"
        onClick={replaceMutation.isPending ? undefined : onClose}
      />

      <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg shadow-lg overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 sm:p-6 pb-4 border-b border-[#E7E5E4] dark:border-[#2D2C30] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] text-[#B08D57] rounded">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif">
                Assign Clubs to {department.shortCode || department.name}
              </h3>
              <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0]">
                Select departmental clubs affiliated with this department
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={replaceMutation.isPending}
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

            {loadingData ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-6 h-6 text-[#B08D57] animate-spin" />
                <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0]">Loading clubs data...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#8E8B85] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search clubs by name or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-[#1C1B1F] dark:text-[#F5F3EF] placeholder-[#A8A5A0] text-sm focus:outline-none transition-colors"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-[#6B6966] dark:text-[#A8A5A0] px-1">
                  <span>{selectedClubIds.length} clubs selected</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-[#B08D57] hover:underline cursor-pointer"
                    >
                      Select all
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-[#8B3A3A] hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto border border-[#E7E5E4] dark:border-[#2D2C30] rounded divide-y divide-[#F0EFEF] dark:divide-[#2D2C30]">
                  {filteredClubs.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#8E8B85]">
                      No non-central clubs found matching search.
                    </div>
                  ) : (
                    filteredClubs.map((club) => {
                      const isSelected = selectedClubIds.includes(club.id);
                      return (
                        <div
                          key={club.id}
                          onClick={() => handleToggleClub(club.id)}
                          className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#FAF9F7] dark:bg-[#252429]'
                              : 'hover:bg-[#FAF9F7]/70 dark:hover:bg-[#252429]/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-[#B08D57] border-[#B08D57] text-white'
                                  : 'border-[#D8D7DC] dark:border-[#4B4950] bg-white dark:bg-[#1C1B1F]'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <div className="truncate">
                              <p className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] truncate">
                                {club.name}
                              </p>
                              {club.description && (
                                <p className="text-[11px] text-[#8E8B85] truncate">
                                  {club.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6 pt-3 border-t border-[#E7E5E4] dark:border-[#2D2C30] bg-[#FAF9F7]/50 dark:bg-[#252429]/50 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={replaceMutation.isPending}
              className="px-4 py-2 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={replaceMutation.isPending || loadingData}
              className="px-4 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {replaceMutation.isPending && (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <Save className="w-3.5 h-3.5" />
              Save Assignments
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AssignClubsModal;
