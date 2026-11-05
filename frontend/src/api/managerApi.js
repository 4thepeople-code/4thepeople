import api from './axios';

export const managerApi = {
  // Auth & Profile
  login: async (email, password) => {
    const res = await api.post('/auth/manager/login', { email, password });
    return res.data;
  },

  getProfile: async () => {
    const res = await api.get('/manager/profile');
    return res.data;
  },

  updateProfile: async (data) => {
    const res = await api.patch('/manager/profile', data);
    return res.data;
  },

  uploadAvatar: async (formData) => {
    const res = await api.post('/manager/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  deleteAvatar: async () => {
    const res = await api.delete('/manager/profile/avatar');
    return res.data;
  },

  requestPasswordReset: async (email) => {
    const res = await api.post('/auth/manager/forgot-password', { email });
    return res.data;
  },

  resetPassword: async (email, otp, password) => {
    const res = await api.post('/auth/manager/reset-password', { email, otp, password });
    return res.data;
  },

  // My Clubs
  getMyClubs: async () => {
    const res = await api.get('/manager/my-clubs');
    return res.data;
  },

  getClubDashboard: async (clubId) => {
    const res = await api.get(`/club/${clubId}/dashboard`);
    return res.data;
  },

  getClub: async (clubId) => {
    const res = await api.get(`/club/${clubId}/dashboard`);
    return res.data;
  },

  updateManagedClub: async (clubId, data) => {
    const res = await api.patch(`/manager/clubs/${clubId}`, data);
    return res.data;
  },

  updateClub: async (clubId, data) => {
    const res = await api.patch(`/manager/clubs/${clubId}`, data);
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

  uploadClubCover: async (clubId, formData) => {
    try {
      const res = await api.post(`/admin/clubs/${clubId}/cover`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        throw new Error('Club cover image upload endpoint is not supported by the backend API.');
      }
      throw err;
    }
  },

  deleteClubCover: async (clubId) => {
    try {
      const res = await api.delete(`/admin/clubs/${clubId}/cover`);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        throw new Error('Club cover image delete endpoint is not supported by the backend API.');
      }
      throw err;
    }
  },

  // Events
  getClubEvents: async (clubId) => {
    const res = await api.get(`/manager/clubs/${clubId}/events`);
    return res.data;
  },

  getClubUpcomingEvents: async (clubId) => {
    const res = await api.get(`/clubs/${clubId}/events/upcoming`);
    return res.data;
  },

  getClubPastEvents: async (clubId) => {
    const res = await api.get(`/clubs/${clubId}/events/past`);
    return res.data;
  },

  getPublicEvent: async (clubId, eventId) => {
    const res = await api.get(`/clubs/${clubId}/events/${eventId}`);
    return res.data;
  },

  createEvent: async (clubId, data) => {
    const res = await api.post(`/manager/clubs/${clubId}/events`, data);
    return res.data;
  },

  updateEvent: async (clubId, eventId, data) => {
    const res = await api.patch(`/manager/clubs/${clubId}/events/${eventId}`, data);
    return res.data;
  },

  cancelEvent: async (clubId, eventId) => {
    const res = await api.patch(`/manager/clubs/${clubId}/events/${eventId}/cancel`);
    return res.data;
  },

  getEventAttendees: async (clubId, eventId, params) => {
    const res = await api.get(`/manager/clubs/${clubId}/events/${eventId}/registrations`, { params });
    return res.data;
  },

  deleteEvent: async (eventId) => {
    const res = await api.delete(`/admin/events/${eventId}`);
    return res.data;
  },

  // Media / Event Cover & Gallery
  uploadEventCover: async (eventId, formData) => {
    const res = await api.post(`/admin/events/${eventId}/cover`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  deleteEventCover: async (eventId) => {
    const res = await api.delete(`/admin/events/${eventId}/cover`);
    return res.data;
  },

  uploadEventGallery: async (eventId, formData) => {
    const res = await api.post(`/admin/events/${eventId}/gallery`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  deleteEventGalleryImage: async (eventId, publicId) => {
    const res = await api.delete(`/admin/events/${eventId}/gallery/${encodeURIComponent(publicId)}`);
    return res.data;
  },
};

export default managerApi;
