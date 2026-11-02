import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Building2, PlusCircle, Edit2, Trash2, Eye, RefreshCw, Users, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import adminApi from '../../api/adminApi';
import DataTable from '../../components/admin/DataTable';
import LoadingSpinner from '../../components/admin/LoadingSpinner';
import EmptyState from '../../components/admin/EmptyState';
import EditClubModal from '../../components/admin/EditClubModal';
import DeleteOtpModal from '../../components/admin/DeleteOtpModal';

const ClubsPage = () => {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [clubToDelete, setClubToDelete] = useState(null);
  const [clubToEdit, setClubToEdit] = useState(null);

  useEffect(() => {
    document.title = 'Club Management | 4 THE PEOPLE';
    fetchClubs();
  }, []);

  const fetchClubs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.getAllClubs();
      const clubList = res.data || [];

      const managerCounts = await Promise.all(
        clubList.map((c) =>
          adminApi
            .getClubManagers(c.id)
            .then((r) => r.data?.managers?.length || 0)
            .catch(() => 0)
        )
      );

      const clubsWithCounts = clubList.map((c, i) => ({
        ...c,
        managerCount: managerCounts[i],
      }));

      setClubs(clubsWithCounts);
    } catch (err) {
      setError('Unable to load clubs list. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async (code) => {
    if (!clubToDelete) return;
    await adminApi.deleteClub(clubToDelete.id, code);
    setClubToDelete(null);
    fetchClubs();
  };

  const filteredClubs = clubs.filter((c) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.description && c.description.toLowerCase().includes(term))
    );
  });

  const columns = [
    {
      header: 'Club Name',
      render: (club) => (
        <div className="flex items-center gap-3">
          {club.logo?.url ? (
            <img
              src={club.logo.url}
              alt={club.name}
              className="w-8 h-8 rounded object-cover border border-[#E7E5E4] shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded bg-[#FAF9F7] border border-[#E7E5E4] text-[#B08D57] font-serif font-semibold text-xs flex items-center justify-center shrink-0">
              {club.name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold text-[#1C1B1F] text-xs sm:text-sm">{club.name}</p>
              {club.isCentral && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider">
                  Central
                </span>
              )}
              {Array.isArray(club.departments) && club.departments.map((d) => (
                <span key={d.id || d.shortCode} className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#FAF9F7] text-[#B08D57] border border-[#E7E5E4] uppercase tracking-wider">
                  {d.shortCode || d.name}
                </span>
              ))}
            </div>
            <p className="text-xs text-[#8E8B85] font-normal truncate max-w-xs">
              {club.description || 'No description provided'}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Managers',
      render: (club) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F0EFEF] text-[#4A4950] border border-[#D8D7DC]">
          <Shield className="w-3 h-3 text-[#6B6966]" />
          {club.managerCount ?? 0}
        </span>
      ),
    },
    {
      header: 'Members',
      render: (club) => {
        const memberCount = club._count?.members || club.members?.length || 0;
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F0EFEF] text-[#4A4950] border border-[#D8D7DC]">
            <Users className="w-3 h-3 text-[#6B6966]" />
            {memberCount}
          </span>
        );
      },
    },
    {
      header: 'Created',
      render: (club) => (
        <span className="text-xs text-[#6B6966]">
          {club.createdAt ? new Date(club.createdAt).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (club) => (
        <div className="flex items-center justify-end gap-1.5">
          <Link
            to={`/admin/clubs/${club.id}`}
            className="p-1.5 text-[#6B6966] hover:text-[#1C1B1F] hover:bg-[#FAF9F7] rounded transition-colors"
            title="Manage Club Details"
          >
            <Eye className="w-4 h-4" />
          </Link>
          <button
            onClick={() => setClubToEdit(club)}
            className="p-1.5 text-[#6B6966] hover:text-[#1C1B1F] hover:bg-[#FAF9F7] rounded transition-colors"
            title="Edit Club Info"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setClubToDelete(club)}
            className="p-1.5 text-[#8B3A3A] hover:bg-[#FDF2F2] rounded transition-colors"
            title="Delete Club"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 font-sans"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#1C1B1F] tracking-tight">Clubs Directory</h1>
          <p className="text-xs sm:text-sm text-[#6B6966]">
            Overview of all active clubs and manager memberships.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={fetchClubs}
            className="px-3.5 py-2 bg-[#F2F0EC] hover:bg-[#E7E5E4] text-[#38373A] text-xs font-medium rounded border border-[#E7E5E4] transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#6B6966]" /> Refresh
          </button>
          <Link
            to="/admin/clubs/create"
            className="px-4 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" /> Create Club
          </Link>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-[#8E8B85] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by club name or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-[#D8D7DC] rounded text-[#1C1B1F] text-xs sm:text-sm placeholder-[#A8A5A0] focus:outline-none focus:border-[#B08D57] transition-colors"
        />
      </div>

      {error && (
        <div className="p-4 bg-[#FDF2F2] border border-[#F3CECE] text-[#8B3A3A] rounded text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchClubs}
            className="px-3 py-1 bg-[#F9E2E2] hover:bg-[#F3CECE] rounded text-xs font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Clubs Table Content */}
      {loading ? (
        <LoadingSpinner fullScreen label="Loading clubs..." />
      ) : filteredClubs.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No clubs found"
          description={
            search
              ? `No clubs matching "${search}".`
              : 'No clubs created yet. Get started by establishing a new club.'
          }
          actionLabel={!search ? 'Create Club' : undefined}
          onAction={() => window.location.href = '/admin/clubs/create'}
        />
      ) : (
        <DataTable columns={columns} data={filteredClubs} keyField="id" />
      )}

      {/* Edit Club Modal */}
      <EditClubModal
        isOpen={!!clubToEdit}
        onClose={() => setClubToEdit(null)}
        onSuccess={fetchClubs}
        club={clubToEdit}
      />

      {/* Delete Club OTP Confirmation Modal */}
      <DeleteOtpModal
        isOpen={!!clubToDelete}
        onClose={() => setClubToDelete(null)}
        onRequestCode={() => adminApi.requestClubDeletionCode(clubToDelete?.id)}
        onConfirm={handleDeleteConfirm}
        title="Delete Club"
        itemType="Club"
        itemName={clubToDelete?.name}
      />
    </motion.div>
  );
};

export default ClubsPage;

