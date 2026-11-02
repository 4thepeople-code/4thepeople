import React, { useState, useEffect } from 'react';
import { Users, X, Search, Check, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import adminApi from '../../api/adminApi';
import { useReplaceDepartmentClubsMutation } from '../../api/apiSlice';
import { formatErrorMessage } from '../../utils/errorUtils';

const AssignClubsModal = ({ isOpen, onClose, department, onSuccess }) => {
  const [clubs, setClubs] = useState([]);
  const [selectedClubIds, setSelectedClubIds] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  const [replaceDepartmentClubs, { isLoading: isSaving }] =
    useReplaceDepartmentClubsMutation();

  useEffect(() => {
    if (isOpen && department?.id) {
      loadData();
    }
  }, [isOpen, department?.id]);

  const loadData = async () => {
    setLoadingData(true);
    setError('');
    try {
      // 1. Fetch current department to get its existing linked clubs
      // 2. Fetch all clubs to get the pool of non-central clubs
      const [deptRes, allClubsRes] = await Promise.all([
        adminApi.getDepartment(department.id).catch(() => ({ data: { department: null } })),
        adminApi.getAllClubs(),
      ]);

      const currentClubs = deptRes?.data?.department?.clubs || deptRes?.department?.clubs || [];
      const currentIds = currentClubs.map((c) => c.id);

      const allClubs = allClubsRes?.data || [];
      // Exclude central clubs per specification
      const nonCentral = allClubs.filter((c) => !c.isCentral);

      setClubs(nonCentral);
      setSelectedClubIds(currentIds);
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to load clubs.'));
    } finally {
      setLoadingData(false);
    }
  };

  if (!isOpen || !department) return null;

  const filteredClubs = clubs.filter((c) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.description && c.description.toLowerCase().includes(term))
    );
  });

  const handleToggleClub = (clubId) => {
    if (isSaving) return;
    if (selectedClubIds.includes(clubId)) {
      setSelectedClubIds(selectedClubIds.filter((id) => id !== clubId));
    } else {
      setSelectedClubIds([...selectedClubIds, clubId]);
    }
  };

  const handleSelectAll = () => {
    if (isSaving) return;
    const filteredIds = filteredClubs.map((c) => c.id);
    setSelectedClubIds(Array.from(new Set([...selectedClubIds, ...filteredIds])));
  };

  const handleClearAll = () => {
    if (isSaving) return;
    setSelectedClubIds([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setError('');

    try {
      await replaceDepartmentClubs({
        departmentId: department.id,
        clubIds: selectedClubIds,
      }).unwrap();

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(
        formatErrorMessage(
          err,
          'Failed to update clubs for this department. Please try again.'
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
          onClick={isSaving ? undefined : onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          className="relative w-full max-w-lg max-h-[90vh] bg-white border border-[#E7E5E4] rounded-lg shadow-lg overflow-hidden z-10 flex flex-col"
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b border-[#E7E5E4] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#FAF9F7] border border-[#E7E5E4] text-[#B08D57] rounded">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#1C1B1F] font-serif">
                  Assign Clubs to Department
                </h3>
                <p className="text-xs text-[#6B6966]">
                  {department.name} ({department.shortCode})
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="text-[#8E8B85] hover:text-[#1C1B1F] transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
            {error && (
              <div className="p-3 bg-[#FDF2F2] border border-[#F3CECE] text-[#8B3A3A] rounded text-xs leading-relaxed">
                {error}
              </div>
            )}

            <p className="text-xs text-[#6B6966]">
              Select which student clubs are affiliated with this academic department. Central clubs are institution-wide and cannot be assigned.
            </p>

            {/* Search and Action Bar */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-[#8E8B85] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search available clubs..."
                  disabled={loadingData || isSaving}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#D8D7DC] focus:border-[#B08D57] rounded text-xs text-[#1C1B1F] focus:outline-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-[#8E8B85]">
                  {selectedClubIds.length} clubs selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    disabled={loadingData || isSaving || clubs.length === 0}
                    className="text-[#B08D57] hover:underline font-medium text-xs disabled:opacity-50"
                  >
                    Select All
                  </button>
                  <span className="text-[#D8D7DC]">|</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={loadingData || isSaving || selectedClubIds.length === 0}
                    className="text-[#8E8B85] hover:text-[#1C1B1F] font-medium text-xs disabled:opacity-50"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Club List */}
            <div className="border border-[#E7E5E4] rounded-lg divide-y divide-[#F0EFEF] max-h-72 overflow-y-auto">
              {loadingData ? (
                <div className="p-8 text-center text-xs text-[#8E8B85] space-y-2">
                  <div className="w-5 h-5 border-2 border-[#B08D57]/30 border-t-[#B08D57] rounded-full animate-spin mx-auto" />
                  <p>Loading clubs...</p>
                </div>
              ) : filteredClubs.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#8E8B85]">
                  {clubs.length === 0
                    ? 'No eligible non-central clubs found.'
                    : `No clubs match "${searchTerm}".`}
                </div>
              ) : (
                filteredClubs.map((club) => {
                  const isSelected = selectedClubIds.includes(club.id);
                  return (
                    <div
                      key={club.id}
                      onClick={() => handleToggleClub(club.id)}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#FAF9F7]'
                          : 'hover:bg-[#FAF9F7]/60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-[#B08D57] border-[#B08D57] text-white'
                              : 'border-[#D8D7DC] bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                        </div>

                        {club.logo?.url ? (
                          <img
                            src={club.logo.url}
                            alt=""
                            className="w-7 h-7 rounded object-cover border border-[#E7E5E4] shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded bg-[#FAF9F7] border border-[#E7E5E4] text-[#B08D57] font-serif font-semibold text-xs flex items-center justify-center shrink-0">
                            {club.name?.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#1C1B1F] truncate">
                            {club.name}
                          </p>
                          <p className="text-[11px] text-[#8E8B85] truncate max-w-xs">
                            {club.description || 'No description provided'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 pt-3 border-t border-[#E7E5E4] bg-[#FAF9F7]/50 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-[#F2F0EC] hover:bg-[#E7E5E4] text-[#38373A] text-xs font-medium rounded border border-[#E7E5E4] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || loadingData}
              className="px-4 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{isSaving ? 'Saving...' : 'Save Clubs'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AssignClubsModal;

