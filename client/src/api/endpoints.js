import { api, BASE_URL } from './client.js';

export const authApi = {
  me: () => api.get('/auth/me'),
  config: (options) => api.get('/auth/config', options),
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
};

export const projectsApi = {
  list: (options) => api.get('/projects', options),
  get: (id, options) => api.get(`/projects/${id}`, options),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.patch(`/projects/${id}`, data),
  remove: (id) => api.delete(`/projects/${id}`),
};

export const auditsApi = {
  listForProject: (projectId, options) => api.get(`/projects/${projectId}/audits`, options),
  start: (projectId, data = {}) => api.post(`/projects/${projectId}/audits`, data),
  get: (id, options) => api.get(`/audits/${id}`, options),
  status: (id, options) => api.get(`/audits/${id}/status`, options),
  eventsUrl: (id) => `${BASE_URL}/audits/${id}/events`,
  pages: (id, options) => api.get(`/audits/${id}/pages`, options),
  page: (id, pageId, options) => api.get(`/audits/${id}/pages/${pageId}`, options),
  remove: (id) => api.delete(`/audits/${id}`),
};
