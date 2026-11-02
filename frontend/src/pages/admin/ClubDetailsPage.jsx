import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Edit2,
  Trash2,
  UserPlus,
  UserCheck,
  Shield,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { motion } from 'framer-motion';
import adminApi from '../../api/adminApi';
import LoadingSpinner from '../../components/admin/LoadingSpinner';
import ConfirmModal from '../../components/admin/ConfirmModal';
import DeleteOtpModal from '../../components/admin/DeleteOtpModal';
import EditClubModal from '../../components/admin/EditClubModal';
import InviteManagerModal from '../../components/admin/InviteManagerModal';
import AddExistingManagerModal from '../../components/admin/AddExistingManagerModal';

const ClubDetailsPage = () => {
  const { clubId } = useParams();
  const navigate = useNavigate();

  const [club, setClub] = useState(null);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const [editClubOpen, setEditClubOpen] = useState(false);
  const [inviteManagerOpen, setInviteManagerOpen] = useState(false);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [deleteClubOpen, setDeleteClubOpen] = useState(false);

  const [membershipToRemove, setMembershipToRemove] = useState(null);
  const [removingMembership, setRemovingMembership] = useState(false);
  const [resendingUserId, setResendingUserId] = useState(null);

  useEffect(() => {
    fetchClubData();
  }, [clubId]);

  const fetchClubData = async () => {
    setLoading(true);
    setError('');
    try {
      const [clubRes, managersRes] = await Promise.all([
        adminApi.getClub(clubId),
        adminApi.getClubManagers(clubId).catch(() => ({ data: { managers: [] } })),
      ]);

      const clubData = clubRes.data || null;
      setClub(clubData);
      setManagers(managersRes.data?.managers || []);
      if (clubData?.name) {
        document.title = `${clubData.name} | 4 THE PEOPLE`;
      } else {
        document.title = 'Club Details | 4 THE PEOPLE';
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load club details.');
    } finally {
      setLoading(false);
    }
  };

  const showSuccessNotice = (msg) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(''), 4000);
  };

  const handleResendInvite = async (userId) => {
    setResendingUserId(userId);
    setError('');
    try {
      await adminApi.resendInvite(userId);
      showSuccessNotice('Invitation email resent successfully!');
      fetchClubData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend invite email.');
    } finally {
      setResendingUserId(null);
    }
  };

  const handleRemoveMembershipConfirm = async () => {
    if (!membershipToRemove) return;
    setRemovingMembership(true);
    try {
      await adminApi.deleteMembership(membershipToRemove.id);
      showSuccessNotice('Manager removed from club successfully.');
      setMembershipToRemove(null);
      fetchClubData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove manager.');
      setMembershipToRemove(null);
    } finally {
      setRemovingMembership(false);
    }
  };

  const handleDeleteClubConfirm = async (code) => {
    await adminApi.deleteClub(clubId, code);
    navigate('/admin/clubs');
  };

  if (loading) {
    return <LoadingSpinner fullScreen label="Loading club details & manager roster..." />;
  }

  if (error && !club) {
    return (
      <div className="p-8 text-center space-y-4 font-sans">
        <div className="p-4 bg-[#FDF2F2] border border-[#F3CECE] text-[#8B3A3A] rounded max-w-md mx-auto text-xs">
          {error}
        </div>
        <Link
          to="/admin/clubs"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#F2F0EC] text-[#38373A] text-xs font-medium rounded border border-[#E7E5E4]"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Clubs List
        </Link>
      </div>
    );
  }

  const existingManagerUserIds = managers.map((m) => m.user?.id).filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-8 max-w-5xl mx-auto font-sans"
    >
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E5E4] pb-5">
        <div className="flex items-center gap-4">
          <Link
            to="/admin/clubs"
            className="p-2 bg-white border border-[#E7E5E4] hover:bg-[#FAF9F7] text-[#6B6966] hover:text-[#1C1B1F] rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          {club?.logo?.url ? (
            <img
              src={club.logo.url}
              alt={club.name}
              className="w-10 h-10 rounded object-cover border border-[#E7E5E4]"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-[#FAF9F7] border border-[#E7E5E4] text-[#B08D57] flex items-center justify-center font-serif text-[#1C1B1F] font-semibold text-base">
              {club?.name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#1C1B1F] tracking-tight">{club?.name}</h1>
            <p className="text-xs text-[#8E8B85]">Club ID: {club?.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => setEditClubOpen(true)}
            className="px-3.5 py-1.5 bg-[#F2F0EC] hover:bg-[#E7E5E4] text-[#38373A] text-xs font-medium rounded border border-[#E7E5E4] transition-colors flex items-center gap-1.5"
          >
            <Edit2 className="w-3.5 h-3.5 text-[#6B6966]" /> Edit Club
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-[#EBF3ED] border border-[#D1E3D7] text-[#2E5A44] rounded text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-[#FDF2F2] border border-[#F3CECE] text-[#8B3A3A] rounded text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Club Details Overview Card */}
      <div className="bg-white border border-[#E7E5E4] rounded-lg p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between border-b border-[#E7E5E4] pb-4">
          <h2 className="text-base font-semibold text-[#1C1B1F] font-serif flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#B08D57]" /> Club Information
          </h2>
          <span className="text-xs text-[#6B6966] flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-[#8E8B85]" /> Created:{' '}
            {club?.createdAt ? new Date(club.createdAt).toLocaleDateString() : 'N/A'}
          </span>
        </div>

        <div className="space-y-1 text-xs">
          <span className="font-medium text-[#6B6966]">Affiliation</span>
          <div>
            {club?.isCentral ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                Central Club (Campus-wide / No department)
              </span>
            ) : Array.isArray(club?.departments) && club.departments.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 items-center">
                {club.departments.map((d) => (
                  <span
                    key={d.id || d.shortCode}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#FAF9F7] text-[#B08D57] border border-[#E7E5E4]"
                  >
                    {d.name} ({d.shortCode})
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-[#8E8B85]">No department affiliation</span>
            )}
          </div>
        </div>

        <div className="space-y-1 text-xs">
          <span className="font-medium text-[#6B6966]">Description</span>
          <p className="text-xs sm:text-sm text-[#1C1B1F] leading-relaxed">
            {club?.description || 'No description available for this club.'}
          </p>
        </div>
      </div>

      {/* Club Managers Management Section */}
      <div className="bg-white border border-[#E7E5E4] rounded-lg p-6 space-y-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E7E5E4] pb-4">
          <div>
            <h2 className="text-base font-semibold text-[#1C1B1F] font-serif flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#B08D57]" /> Assigned Managers ({managers.length})
            </h2>
            <p className="text-xs text-[#6B6966]">Managers have full administrative control over this club</p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={() => setAddExistingOpen(true)}
              className="px-3.5 py-1.5 bg-[#F2F0EC] hover:bg-[#E7E5E4] text-[#38373A] text-xs font-medium rounded border border-[#E7E5E4] transition-colors flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#6B6966]" /> Add Existing Manager
            </button>
            <button
              onClick={() => setInviteManagerOpen(true)}
              className="px-3.5 py-1.5 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" /> Invite New Manager
            </button>
          </div>
        </div>

        {/* Managers List */}
        {managers.length === 0 ? (
          <div className="p-8 text-center bg-[#FAF9F7] border border-[#E7E5E4] rounded text-[#6B6966] text-xs">
            No managers currently assigned to this club. Use the actions above to add a manager.
          </div>
        ) : (
          <div className="divide-y divide-[#F0EFEF]">
            {managers.map((m) => {
              const u = m.user || {};
              const isPending = !u.isActive;

              return (
                <div
                  key={m.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[#FAF9F7] border border-[#E7E5E4] text-[#B08D57] flex items-center justify-center font-serif text-xs font-semibold">
                      {u.name?.charAt(0).toUpperCase() || 'M'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#1C1B1F] text-xs sm:text-sm">{u.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F0EFEF] text-[#4A4950] border border-[#D8D7DC]">
                          {m.role || 'MANAGER'}
                        </span>
                      </div>
                      <p className="text-xs text-[#8E8B85]">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.isActive
                          ? 'bg-[#EBF3ED] text-[#2E5A44] border border-[#D1E3D7]'
                          : 'bg-[#FAF4E8] text-[#8A6421] border border-[#EEDFA8]'
                      }`}
                    >
                      {u.isActive ? (
                        <>
                          <CheckCircle className="w-3 h-3" /> Active
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" /> Invite Pending
                        </>
                      )}
                    </span>

                    {isPending && (
                      <button
                        onClick={() => handleResendInvite(u.id)}
                        disabled={resendingUserId === u.id}
                        className="px-2.5 py-1 bg-[#F2F0EC] hover:bg-[#E7E5E4] text-[#38373A] border border-[#E7E5E4] rounded text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                        title="Resend Invitation Email"
                      >
                        {resendingUserId === u.id && (
                          <span className="w-3 h-3 border-2 border-[#6B6966]/30 border-t-[#6B6966] rounded-full animate-spin" />
                        )}
                        <Send className="w-3 h-3 text-[#B08D57]" /> Resend
                      </button>
                    )}

                    <button
                      onClick={() => setMembershipToRemove(m)}
                      className="px-2.5 py-1 bg-[#FDF2F2] hover:bg-[#F9E2E2] text-[#8B3A3A] border border-[#F3CECE] rounded text-xs font-medium transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Danger Zone Card */}
      <div className="bg-white border border-[#F3CECE] rounded-lg p-6 space-y-3">
        <h2 className="text-base font-semibold text-[#8B3A3A] font-serif flex items-center gap-2">
          <Trash2 className="w-4 h-4" /> Danger Zone
        </h2>
        <p className="text-xs text-[#6B6966]">
          Permanently remove this club entity. This action cannot be undone.
        </p>

        <button
          onClick={() => setDeleteClubOpen(true)}
          className="px-4 py-2 bg-[#8B3A3A] hover:bg-[#722F2F] text-white text-xs font-medium rounded transition-colors"
        >
          Delete Club
        </button>
      </div>

      {/* Modals */}
      <EditClubModal
        isOpen={editClubOpen}
        onClose={() => setEditClubOpen(false)}
        onSuccess={fetchClubData}
        club={club}
      />

      <InviteManagerModal
        isOpen={inviteManagerOpen}
        onClose={() => setInviteManagerOpen(false)}
        onSuccess={() => {
          showSuccessNotice('Manager invitation sent!');
          fetchClubData();
        }}
        clubId={clubId}
      />

      <AddExistingManagerModal
        isOpen={addExistingOpen}
        onClose={() => setAddExistingOpen(false)}
        onSuccess={() => {
          showSuccessNotice('Existing manager added!');
          fetchClubData();
        }}
        clubId={clubId}
        existingManagerIds={existingManagerUserIds}
      />

      <ConfirmModal
        isOpen={!!membershipToRemove}
        onClose={() => setMembershipToRemove(null)}
        onConfirm={handleRemoveMembershipConfirm}
        title="Remove Club Manager?"
        message={`Are you sure you want to remove ${membershipToRemove?.user?.name} from managing ${club?.name}?`}
        confirmText="Remove Manager"
        isDestructive={true}
        isLoading={removingMembership}
      />

      <DeleteOtpModal
        isOpen={deleteClubOpen}
        onClose={() => setDeleteClubOpen(false)}
        onRequestCode={() => adminApi.requestClubDeletionCode(clubId)}
        onConfirm={handleDeleteClubConfirm}
        title="Delete Entire Club"
        itemType="Club"
        itemName={club?.name}
      />
    </motion.div>
  );
};

export default ClubDetailsPage;

