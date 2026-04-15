import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dexter_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Add language header
  const lang = localStorage.getItem('dexter_language') || 'pt-BR';
  config.headers['Accept-Language'] = lang;
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('dexter_token');
      localStorage.removeItem('dexter_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: { name?: string; email?: string }) =>
    api.put('/auth/profile', data),
};

// Projects
export const projectApi = {
  getAll: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get('/projects', { params }),
  getById: (id: string) => api.get(`/projects/${id}`),
  create: (data: { name?: string }) => api.post('/projects', data),
  update: (id: string, data: { name?: string; status?: string }) =>
    api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  export: (id: string) =>
    api.get(`/projects/${id}/export`, { responseType: 'blob' }),
};

// Clone
export const cloneApi = {
  clone: (data: { url: string; name?: string }) => api.post('/clone', data),
  cloneStream: (data: { url: string; name?: string }) => {
    const token = localStorage.getItem('dexter_token');
    return fetch(API_URL + '/clone/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify(data),
    });
  },
  getStatus: (projectId: string) => api.get(`/clone/status/${projectId}`),
};

// Upload
export const uploadApi = {
  uploadProject: (file: File, name?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
  },
};

// Pages
export const pageApi = {
  getById: (id: string) => api.get(`/pages/${id}`),
  update: (id: string, data: {
    html?: string;
    css?: string;
    js?: string;
    gjsData?: Record<string, unknown>;
    name?: string;
    meta_data?: Record<string, unknown>;
  }) => api.put(`/pages/${id}`, data),
  create: (projectId: string, data?: { name?: string }) =>
    api.post(`/pages/project/${projectId}`, data),
  delete: (id: string) => api.delete(`/pages/${id}`),
  saveVersion: (id: string) => api.post(`/pages/${id}/versions`),
  getVersions: (id: string) => api.get(`/pages/${id}/versions`),
  restoreVersion: (id: string, versionId: string) =>
    api.post(`/pages/${id}/versions/restore`, { versionId }),
};

// Assets
export const assetApi = {
  upload: (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/pages/project/${projectId}/assets`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getAll: (projectId: string) => api.get(`/pages/project/${projectId}/assets`),
};

export default api;
