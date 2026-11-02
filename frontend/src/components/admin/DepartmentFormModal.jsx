import React, { useState, useEffect } from 'react';
import { Building2, X, PlusCircle, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
} from '../../api/apiSlice';
import { formatErrorMessage } from '../../utils/errorUtils';

const DepartmentFormModal = ({
  isOpen,
  onClose,
  department = null,
  onSuccess,
}) => {
  const isEditing = Boolean(department?.id);

  const [name, setName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const [createDepartment, { isLoading: isCreating }] =
    useCreateDepartmentMutation();
  const [updateDepartment, { isLoading: isUpdating }] =
    useUpdateDepartmentMutation();

  const isSubmitting = isCreating || isUpdating;

  useEffect(() => {
    if (department) {
      setName(department.name || '');
      setShortCode(department.shortCode || '');
      setDescription(department.description || '');
    } else {
      setName('');
      setShortCode('');
      setDescription('');
    }
    setError('');
  }, [department, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
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
      if (isEditing) {
        await updateDepartment({
          departmentId: department.id,
          name: name.trim(),
          shortCode: shortCode.trim().toUpperCase(),
          description: description.trim() || null,
        }).unwrap();
      } else {
        await createDepartment({
          name: name.trim(),
          shortCode: shortCode.trim().toUpperCase(),
          description: description.trim() || null,
        }).unwrap();
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(
        formatErrorMessage(
          err,
          `Failed to ${isEditing ? 'update' : 'create'} department.`
        )
      );
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#1C1B1F]/50 backdrop-blur-xs"
          onClick={isSubmitting ? undefined : onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          className="relative w-full max-w-lg bg-white border border-[#E7E5E4] rounded-lg shadow-lg overflow-hidden z-10 flex flex-col"
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b border-[#E7E5E4] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#FAF9F7] border border-[#E7E5E4] text-[#B08D57] rounded">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#1C1B1F] font-serif">
                  {isEditing ? 'Edit Department' : 'Create Academic Department'}
                </h3>
                <p className="text-xs text-[#6B6966]">
                  {isEditing
                    ? `Update information for ${department?.name}`
                    : 'Add a new academic department to categorize clubs'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="text-[#8E8B85] hover:text-[#1C1B1F] transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1">
            <div className="p-6 space-y-4 overflow-y-auto">
              {error && (
                <div className="p-3 bg-[#FDF2F2] border border-[#F3CECE] text-[#8B3A3A] rounded text-xs leading-relaxed">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#6B6966] mb-1.5">
                  Department Name <span className="text-[#8B3A3A]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science and Engineering"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 bg-white border border-[#D8D7DC] focus:border-[#B08D57] rounded text-[#1C1B1F] text-sm placeholder-[#A8A5A0] focus:outline-none transition-colors disabled:bg-[#F7F6F2]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#6B6966] mb-1.5">
                  Short Code <span className="text-[#8B3A3A]">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="e.g. CSE"
                  value={shortCode}
                  onChange={(e) => setShortCode(e.target.value.toUpperCase())}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 bg-white border border-[#D8D7DC] focus:border-[#B08D57] rounded text-[#1C1B1F] text-sm uppercase placeholder-[#A8A5A0] focus:outline-none transition-colors disabled:bg-[#F7F6F2]"
                />
                <p className="text-[11px] text-[#8E8B85] mt-1">
                  Unique identifier used for department badges and URL filters.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#6B6966] mb-1.5">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Brief description of this department's academic discipline or student scope..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full p-3 bg-white border border-[#D8D7DC] focus:border-[#B08D57] rounded text-[#1C1B1F] text-sm placeholder-[#A8A5A0] focus:outline-none transition-colors resize-none disabled:bg-[#F7F6F2]"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 sm:p-6 pt-3 border-t border-[#E7E5E4] bg-[#FAF9F7]/50 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-[#F2F0EC] hover:bg-[#E7E5E4] text-[#38373A] text-xs font-medium rounded border border-[#E7E5E4] transition-colors disabled:opacity-50"
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
                <span>
                  {isSubmitting
                    ? isEditing
                      ? 'Saving...'
                      : 'Creating...'
                    : isEditing
                    ? 'Save Changes'
                    : 'Create Department'}
                </span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default DepartmentFormModal;

