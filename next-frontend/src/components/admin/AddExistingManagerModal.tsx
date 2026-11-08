'use client';

import React, { useState } from 'react';
import { UserCheck, X, Search, Loader2 } from 'lucide-react';
import { useAllUsersQuery, useAddExistingManagerToClubMutation } from '@/lib/api/admin';

export interface AddExistingManagerModalProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  clubId: string;
  existingManagerIds?: string[];
}

export function AddExistingManagerModal({
  slug,
  isOpen,
  onClose,
  onSuccess,
  clubId,
  existingManagerIds = [],
}: AddExistingManagerModalProps) {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const { data: allUsers = [], isLoading: fetching } = useAllUsersQuery(slug, isOpen);
  const addManagerMutation = useAddExistingManagerToClubMutation(slug);

  if (!isOpen) return null;

  const availableUsers = allUsers.filter(
    (u) => u.isActive && !existingManagerIds.includes(u.id)
  );

  const filteredUsers = availableUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedUserId) {
      setError('Please select a user to add as manager.');
      return;
    }

    try {
      await addManagerMutation.mutateAsync({ clubId, userId: selectedUserId });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setError(errObj.response?.data?.message || 'Failed to assign manager to club.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
      <div
        className="fixed inset-0 bg-[#1C1B1F]/50 backdrop-blur-xs transition-opacity"
        onClick={addManagerMutation.isPending ? undefined : onClose}
      />

      <div className="relative w-full max-w-md md:max-w-xl max-h-[92vh] flex flex-col bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg shadow-lg overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 sm:p-6 pb-4 border-b border-[#E7E5E4] dark:border-[#2D2C30] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#EBF3ED] dark:bg-emerald-950/40 border border-[#D1E3D7] dark:border-emerald-900/60 text-[#2E5A44] dark:text-emerald-400 rounded">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif">Add Existing Manager</h3>
              <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0]">Assign an active registered user to manage this club</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={addManagerMutation.isPending}
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

            {fetching ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-6 h-6 text-[#B08D57] animate-spin" />
                <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0]">Loading available users...</p>
              </div>
            ) : availableUsers.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8E8B85]">
                No available active users to assign as manager.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#8E8B85] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search active users by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-[#1C1B1F] dark:text-[#F5F3EF] placeholder-[#A8A5A0] text-sm focus:outline-none transition-colors"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto border border-[#E7E5E4] dark:border-[#2D2C30] rounded divide-y divide-[#F0EFEF] dark:divide-[#2D2C30]">
                  {filteredUsers.map((u) => {
                    const isSelected = selectedUserId === u.id;
                    return (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#FAF9F7] dark:bg-[#252429] border-l-2 border-[#B08D57]'
                            : 'hover:bg-[#FAF9F7]/70 dark:hover:bg-[#252429]/50'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">{u.name}</p>
                          <p className="text-[11px] text-[#8E8B85]">{u.email}</p>
                        </div>
                        <input
                          type="radio"
                          name="selectedManager"
                          checked={isSelected}
                          onChange={() => setSelectedUserId(u.id)}
                          className="accent-[#B08D57]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6 pt-3 border-t border-[#E7E5E4] dark:border-[#2D2C30] bg-[#FAF9F7]/50 dark:bg-[#252429]/50 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={addManagerMutation.isPending}
              className="px-4 py-2 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addManagerMutation.isPending || !selectedUserId}
              className="px-4 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {addManagerMutation.isPending && (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              Assign Manager
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddExistingManagerModal;

