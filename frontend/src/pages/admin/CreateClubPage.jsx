import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Building2, AlignLeft, PlusCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import adminApi from '../../api/adminApi';
import {
  useGetDepartmentsQuery,
  useReplaceClubDepartmentsMutation,
} from '../../api/apiSlice';
import MultiSelect from '../../components/common/MultiSelect';
import { formatErrorMessage } from '../../utils/errorUtils';

const CreateClubPage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCentral, setIsCentral] = useState(false);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  React.useEffect(() => {
    document.title = 'Create Club | 4 THE PEOPLE';
  }, []);

  const handleCentralChange = (e) => {
    const checked = e.target.checked;
    setIsCentral(checked);
    if (checked) {
      setSelectedDepartmentIds([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (!name.trim()) {
      setError('Club name is required.');
      return;
    }

    setLoading(true);
    try {
      const res = await adminApi.createClub({
        name: name.trim(),
        description: description.trim() || null,
        isCentral,
      });

      const newClubId = res.data?.id;

      // If club is not central and departments were chosen, associate them
      if (!isCentral && selectedDepartmentIds.length > 0 && newClubId) {
        await replaceClubDepartments({
          clubId: newClubId,
          departmentIds: selectedDepartmentIds,
        }).unwrap();
      }

      if (newClubId) {
        navigate(`/admin/clubs/${newClubId}`);
      } else {
        navigate('/admin/clubs');
      }
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to create club. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-3xl mx-auto font-sans"
    >
      {/* Navigation Header */}
      <div className="flex items-center gap-4 border-b border-[#E7E5E4] pb-5">
        <Link
          to="/admin/clubs"
          className="p-2 bg-white border border-[#E7E5E4] hover:bg-[#FAF9F7] text-[#6B6966] hover:text-[#1C1B1F] rounded transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#1C1B1F] tracking-tight">Create New Club</h1>
          <p className="text-xs text-[#6B6966]">Establish a new student organization entity</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[#FDF2F2] border border-[#F3CECE] text-[#8B3A3A] rounded text-xs leading-relaxed">
          {error}
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-[#E7E5E4] rounded-lg p-6 space-y-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div>
          <label className="block text-xs font-medium text-[#6B6966] mb-1.5">
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
              disabled={loading}
              className="w-full pl-9 pr-4 py-2 bg-white border border-[#D8D7DC] focus:border-[#B08D57] rounded text-[#1C1B1F] text-sm placeholder-[#A8A5A0] focus:outline-none transition-colors disabled:bg-[#F7F6F2]"
            />
          </div>
        </div>

        {/* Central Club Option */}
        <div className="p-4 bg-[#FAF9F7] border border-[#E7E5E4] rounded-lg space-y-2">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isCentral}
              onChange={handleCentralChange}
              disabled={loading}
              className="mt-0.5 w-4 h-4 text-[#B08D57] border-[#D8D7DC] rounded focus:ring-[#B08D57] accent-[#B08D57]"
            />
            <div>
              <span className="text-xs font-semibold text-[#1C1B1F]">
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
            disabled={isCentral || loading}
            disabledNote="Central clubs belong to no department."
            placeholder={isCentral ? "Disabled for central clubs" : "Select one or more academic departments..."}
            searchPlaceholder="Search departments..."
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#6B6966] mb-1.5">
            Description
          </label>
          <div className="relative">
            <AlignLeft className="w-4 h-4 text-[#8E8B85] absolute left-3 top-3" />
            <textarea
              rows={4}
              placeholder="Provide a brief overview of the club's purpose, mission, and activities..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#D8D7DC] focus:border-[#B08D57] rounded text-[#1C1B1F] text-sm placeholder-[#A8A5A0] focus:outline-none transition-colors resize-none disabled:bg-[#F7F6F2]"
            />
          </div>
        </div>

        <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#E7E5E4]">
          <Link
            to="/admin/clubs"
            className="px-4 py-2 bg-[#F2F0EC] hover:bg-[#E7E5E4] text-[#38373A] text-xs font-medium rounded border border-[#E7E5E4] transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="px-4 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <PlusCircle className="w-3.5 h-3.5" />
            )}
            <span>{loading ? 'Creating Club...' : 'Create Club'}</span>
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default CreateClubPage;
