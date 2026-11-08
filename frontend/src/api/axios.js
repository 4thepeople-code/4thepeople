import axios from 'axios';

const API_BASE_URL = import.meta.env.BACKEND_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: import.meta.env.BACKEND_URL || "http://localhost:3000",
  withCredentials: true,
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('adminToken') ||
      localStorage.getItem('managerToken');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for generic error parsing
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clean up token if unauthorized response occurs
      const hasToken =
        localStorage.getItem('token') ||
        localStorage.getItem('adminToken') ||
        localStorage.getItem('managerToken');
      if (hasToken) {
        localStorage.removeItem('token');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('managerToken');
        localStorage.removeItem('adminUser');
        localStorage.removeItem('managerUser');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
