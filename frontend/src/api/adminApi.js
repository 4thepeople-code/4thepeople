import api from './axios';

export const adminApi = {
  // Auth & Profile
  login: async (email, password) => {
    const res = await api.post('/auth/admin/login', { email, password });
    return res.data;
  },

  getProfile: async () => {
    const res = await api.get('/admin/profile');
    return res.data;
  },

  updateProfile: async (data) => {
    const res = await api.patch('/admin/profile', data);
    return res.data;
  },

  uploadAvatar: async (formData) => {
    const res = await api.post('/admin/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  deleteAvatar: async () => {
    const res = await api.delete('/admin/profile/avatar');
    return res.data;
  },

  // Users
  getAllUsers: async () => {
    const res = await api.get('/admin/viewAllUsers');
    return res.data;
  },

  getUser: async (userId) => {
    const res = await api.get(`/admin/viewUser/${userId}`);
    return res.data;
  },

  requestUserDeletionCode: async (userId) => {
    const res = await api.post(`/admin/users/${userId}/delete/request-code`);
    return res.data;
  },

  deleteUser: async (userId, code) => {
    const response = await api.delete(`/admin/deleteUser/${userId}`, { data: { code } });
    return response.data;
  },

  // Managers General
  createManager: async (data) => {
    const res = await api.post('/admin/managers', data);
    return res.data;
  },

  resendInvite: async (userId) => {
    const res = await api.post(`/admin/managers/${userId}/resend-invite`);
    return res.data;
  },

  // Clubs
  getAllClubs: async () => {
    const res = await api.get('/admin/clubs');
    return res.data;
  },

  getClub: async (clubId) => {
    const res = await api.get(`/admin/clubs/${clubId}`);
    return res.data;
  },

  requestClubDeletionCode: async (clubId) => {
    const res = await api.post(`/admin/clubs/${clubId}/delete/request-code`);
    return res.data;
  },

  createClub: async (data) => {
    try {
      const res = await api.post('/admin/create-club', data);
      return res.data;
    } catch (err) {
      if (err.response && err.response.status === 404) {
        const fallback = await api.post('/admin/clubs', data);
        return fallback.data;
      }
      throw err;
    }
  },

  updateClub: async (clubId, data) => {
    const res = await api.patch(`/admin/clubs/${clubId}`, data);
    return res.data;
  },

  uploadClubLogo: async (clubId, formData) => {
    const res = await api.post(`/admin/clubs/${clubId}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  deleteClubLogo: async (clubId) => {
    const res = await api.delete(`/admin/clubs/${clubId}/logo`);
    return res.data;
  },

  deleteClub: async (clubId, code) => {
    const res = await api.delete(`/admin/clubs/${clubId}`, { data: { code } });
    return res.data;
  },

  // Club Managers & Memberships
  getClubManagers: async (clubId) => {
    const res = await api.get(`/admin/clubs/${clubId}/managers`);
    return res.data;
  },

  inviteManagerToClub: async (clubId, data) => {
    const res = await api.post(`/admin/clubs/${clubId}/managers`, data);
    return res.data;
  },

  addExistingManagerToClub: async (clubId, userId) => {
    const res = await api.post(`/admin/clubs/${clubId}/managers/existing`, { userId });
    return res.data;
  },

  updateMembership: async (membershipId, role) => {
    const res = await api.patch(`/admin/memberships/${membershipId}`, { role });
    return res.data;
  },

  deleteMembership: async (membershipId) => {
    const res = await api.delete(`/admin/memberships/${membershipId}`);
    return res.data;
  },

  // Departments
  getAllDepartments: async () => {
    const res = await api.get('/departments');
    return res.data;
  },

  getDepartment: async (departmentId) => {
    const res = await api.get(`/departments/${departmentId}`);
    return res.data;
  },

  createDepartment: async (data) => {
    const res = await api.post('/admin/departments', data);
    return res.data;
  },

  updateDepartment: async (departmentId, data) => {
    const res = await api.patch(`/admin/departments/${departmentId}`, data);
    return res.data;
  },

  deleteDepartment: async (departmentId) => {
    const res = await api.delete(`/admin/departments/${departmentId}`);
    return res.data;
  },

  replaceDepartmentClubs: async (departmentId, clubIds) => {
    const res = await api.put(`/admin/departments/${departmentId}/clubs`, { clubIds });
    return res.data;
  },

  replaceClubDepartments: async (clubId, departmentIds) => {
    const res = await api.put(`/admin/clubs/${clubId}/departments`, { departmentIds });
    return res.data;
  },
};

export default adminApi;
