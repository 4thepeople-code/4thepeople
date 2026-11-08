import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to perform this action?',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isDestructive = true,
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1C1B1F]/50 backdrop-blur-xs transition-opacity"
        onClick={isLoading ? undefined : onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md max-h-[92vh] flex flex-col bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg shadow-lg overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded border ${
                  isDestructive
                    ? 'bg-[#FDF2F2] dark:bg-rose-950/40 border-[#F3CECE] dark:border-rose-900/60 text-[#8B3A3A] dark:text-rose-400'
                    : 'bg-[#FAF4E8] dark:bg-amber-950/40 border-[#EEDFA8] dark:border-amber-900/60 text-[#8A6421] dark:text-amber-400'
                }`}
              >
                <AlertTriangle className="w-4 h-4 stroke-[1.75]" />
              </div>
              <h3 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif">{title}</h3>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="text-[#8E8B85] hover:text-[#1C1B1F] dark:hover:text-[#F5F3EF] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="mt-3 text-sm text-[#6B6966] dark:text-[#A8A5A0] leading-relaxed">{message}</p>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-4 py-2 text-white text-xs font-medium rounded transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer ${
                isDestructive
                  ? 'bg-[#8B3A3A] hover:bg-[#722F2F]'
                  : 'bg-[#B08D57] hover:bg-[#997847]'
              }`}
            >
              {isLoading && (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;

