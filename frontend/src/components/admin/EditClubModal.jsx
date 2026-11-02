import React, { useState, useEffect, useRef } from 'react';
import { Edit2, X, Building2, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import adminApi from '../../api/adminApi';
import {
  useGetDepartmentsQuery,
  useReplaceClubDepartmentsMutation,
} from '../../api/apiSlice';
import MultiSelect from '../common/MultiSelect';
import { formatErrorMessage } from '../../utils/errorUtils';

const EditClubModal = ({ isOpen, onClose, onSuccess, club }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCentral, setIsCentral] = useState(false);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState([]);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState(null);
  const [deletingLogo, setDeletingLogo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  const { data: deptData } = useGetDepartmentsQuery();
  const [replaceClubDepartments] = useReplaceClubDepartmentsMutation();

  const departments = Array.isArray(deptData)
    ? deptData
    : Array.isArray(deptData?.data?.departments)
    ? deptData.data.departments
    : Array.isArray(deptData?.departments)
    ? deptData.departments
    : [];

  const departmentOptions = departments.map((d) => ({
    value: d.id,
    label: d.name,
    badge: d.shortCode,
  }));

  useEffect(() => {
    if (club) {
      setName(club.name || '');
      setDescription(club.description || '');
      setExistingLogoUrl(club.logo?.url || null);
      setLogoFile(null);
      setLogoPreview(null);
      setIsCentral(Boolean(club.isCentral));
      const currentDeptIds = Array.isArray(club.departments)
        ? club.departments.map((d) => d.id || d)
        : [];
      setSelectedDepartmentIds(currentDeptIds);
      setError('');
    }
  }, [club, isOpen]);

  if (!isOpen || !club) return null;

  const handleCentralChange = (e) => {
    const checked = e.target.checked;
    setIsCentral(checked);
    if (checked) {
      setSelectedDepartmentIds([]);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
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
    setDeletingLogo(true);
    setError('');
    try {
      await adminApi.deleteClubLogo(club.id);
      setExistingLogoUrl(null);
      setLogoFile(null);
      setLogoPreview(null);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to remove club logo'));
    } finally {
      setDeletingLogo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || deletingLogo) return;
    setError('');

    if (!name.trim()) {
      setError('Club name is required');
      return;
    }

    setLoading(true);
    try {
      if (isCentral) {
        // Requirement: "On save for an existing club that has department links and is now marked central,
        // first save the departments as an empty list, then update the club."
        await replaceClubDepartments({
          clubId: club.id,
          departmentIds: [],
        }).unwrap();

        await adminApi.updateClub(club.id, {
          name: name.trim(),
          description: description.trim() || null,
          isCentral: true,
        });
      } else {
        // First update the club properties (isCentral: false)
        await adminApi.updateClub(club.id, {
          name: name.trim(),
          description: description.trim() || null,
          isCentral: false,
        });

        // Then replace club department links
        await replaceClubDepartments({
          clubId: club.id,
          departmentIds: selectedDepartmentIds,
        }).unwrap();
      }

      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        await adminApi.uploadClubLogo(club.id, formData);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to update club details'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#1C1B1F]/50 backdrop-blur-xs"
          onClick={loading || deletingLogo ? undefined : onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          className="relative w-full max-w-md md:max-w-2xl max-h-[92vh] flex flex-col bg-white border border-[#E7E5E4] rounded-lg shadow-lg overflow-hidden z-10"
        >
          {/* Modal Header */}
          <div className="p-5 sm:p-6 pb-4 border-b border-[#E7E5E4] shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#FAF9F7] border border-[#E7E5E4] text-[#B08D57] rounded">
                <Edit2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#1C1B1F] font-serif">Edit Club Details</h3>
                <p className="text-xs text-[#6B6966]">Update information, affiliation, and logo for {club.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading || deletingLogo}
              className="text-[#8E8B85] hover:text-[#1C1B1F] transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            {/* Scrollable Form Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {error && (
                <div className="p-3 bg-[#FDF2F2] border border-[#F3CECE] rounded text-xs text-[#8B3A3A] leading-relaxed">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Club Logo Section */}
                <div>
                  <label className="block text-xs font-medium text-[#6B6966] mb-1.5">
                    Club Logo
                  </label>
                  <div className="flex items-center gap-3 bg-[#FAF9F7] border border-[#E7E5E4] p-3 rounded h-[76px]">
                    {logoPreview || existingLogoUrl ? (
                      <img
                        src={logoPreview || existingLogoUrl}
                        alt="Club Logo Preview"
                        className="w-12 h-12 rounded object-cover border border-[#E7E5E4] shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-white border border-[#E7E5E4] flex items-center justify-center text-[#8E8B85] shrink-0">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={loading || deletingLogo}
                          className="px-2.5 py-1 bg-white hover:bg-[#F2F0EC] text-[#1C1B1F] text-xs font-medium rounded border border-[#E7E5E4] transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#B08D57]" />
                          {logoPreview || existingLogoUrl ? 'Change' : 'Upload'}
                        </button>

                        {existingLogoUrl && !logoPreview && (
                          <button
                            type="button"
                            onClick={handleDeleteLogo}
                            disabled={deletingLogo || loading}
                            className="px-2.5 py-1 bg-[#FDF2F2] hover:bg-[#F9E2E2] text-[#8B3A3A] text-xs font-medium rounded border border-[#F3CECE] transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            {deletingLogo ? (
                              <span className="w-3 h-3 border-2 border-[#8B3A3A]/30 border-t-[#8B3A3A] rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8E8B85] truncate">
                        {logoFile ? logoFile.name : 'PNG, JPG, max 5MB'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Club Name */}
                <div>
                  <label className="block text-xs font-medium text-[#6B6966] mb-1.5">
                    Club Name <span className="text-[#8B3A3A]">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-[#8E8B85] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Robotics Club"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={loading || deletingLogo}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-[#D8D7DC] focus:border-[#B08D57] rounded text-[#1C1B1F] text-sm focus:outline-none h-[42px] disabled:bg-[#F7F6F2]"
                    />
                  </div>
                </div>

                {/* Central Club Option - Spanning both columns */}
                <div className="md:col-span-2 p-3 bg-[#FAF9F7] border border-[#E7E5E4] rounded-lg">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isCentral}
                      onChange={handleCentralChange}
                      disabled={loading || deletingLogo}
                      className="mt-0.5 w-4 h-4 text-[#B08D57] border-[#D8D7DC] rounded focus:ring-[#B08D57] accent-[#B08D57]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-[#1C1B1F]">
                        Central club (Institution-wide / no department)
                      </span>
                      <p className="text-[11px] text-[#8E8B85] mt-0.5">
                        When enabled, any existing department links are cleared because central clubs belong to no department.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Department Affiliation Multi-Select - Spanning both columns */}
                <div className="md:col-span-2">
                  <MultiSelect
                    label="Department Affiliation"
                    options={departmentOptions}
                    selectedValues={selectedDepartmentIds}
                    onChange={setSelectedDepartmentIds}
                    disabled={isCentral || loading || deletingLogo}
                    disabledNote="Central clubs belong to no department."
                    placeholder={isCentral ? "Disabled for central clubs" : "Select one or more academic departments..."}
                    searchPlaceholder="Search departments..."
                  />
                </div>

                {/* Description - Spanning both columns on desktop */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-[#6B6966] mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe the club's objective..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={loading || deletingLogo}
                    className="w-full p-3 bg-white border border-[#D8D7DC] focus:border-[#B08D57] rounded text-[#1C1B1F] text-sm focus:outline-none resize-none disabled:bg-[#F7F6F2]"
                  />
                </div>
              </div>
            </div>

            {/* Pinned Action Buttons Footer */}
            <div className="p-4 sm:p-6 pt-3 border-t border-[#E7E5E4] bg-[#FAF9F7]/50 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={loading || deletingLogo}
                className="px-4 py-2 bg-[#F2F0EC] hover:bg-[#E7E5E4] text-[#38373A] text-xs font-medium rounded border border-[#E7E5E4] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || deletingLogo || !name.trim()}
                className="px-4 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                <span>{loading ? 'Saving Changes...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default EditClubModal;
