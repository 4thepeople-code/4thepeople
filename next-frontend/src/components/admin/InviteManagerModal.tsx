'use client';

import React, { useState } from 'react';
import { UserPlus, X, Mail, User as UserIcon } from 'lucide-react';
import { useCreateManagerMutation, useInviteManagerToClubMutation } from '@/lib/api/admin';

export interface InviteManagerModalProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  clubId?: string | null;
}

export function InviteManagerModal({
  slug,
  isOpen,
  onClose,
  onSuccess,
  clubId = null,
}: InviteManagerModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const createManagerMutation = useCreateManagerMutation(slug);
  const inviteToClubMutation = useInviteManagerToClubMutation(slug);

  const isSubmitting = createManagerMutation.isPending || inviteToClubMutation.isPending;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim()) {
      setError('Please fill in all fields.');
      return;
    }

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
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setError(errObj.response?.data?.message || 'Failed to send manager invitation. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1C1B1F]/50 backdrop-blur-xs transition-opacity"
        onClick={isSubmitting ? undefined : onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md md:max-w-xl max-h-[92vh] flex flex-col bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg shadow-lg overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-[#E7E5E4] dark:border-[#2D2C30] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] text-[#B08D57] rounded">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif">
                {clubId ? 'Invite Manager to Club' : 'Create Manager Account'}
              </h3>
              <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0]">Send an invitation email to setup manager access</p>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#8E8B85] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-[#1C1B1F] dark:text-[#F5F3EF] placeholder-[#A8A5A0] text-sm focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#8E8B85] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. manager@college.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-[#1C1B1F] dark:text-[#F5F3EF] placeholder-[#A8A5A0] text-sm focus:outline-none transition-colors"
                  />
                </div>
              </div>
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
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting && (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              Send Invitation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default InviteManagerModal;

