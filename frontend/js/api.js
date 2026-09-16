// URL base centralizada del backend. Configurable en js/config.js
// (window.APP_CONFIG); el valor de abajo es el fallback local.
const API_BASE_URL =
  (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) ||
  'http://localhost:3000/api';

async function apiRequest(path, options = {}) {
  const { method = 'GET', body, token } = options;

  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    const err = new Error('No se pudo conectar con el servidor');
    err.status = 0;
    throw err;
  }

  let data = null;
  try {
    data = await res.json();
  } catch (error) {
    data = null;
  }

  if (!res.ok) {
    const err = new Error((data && data.message) || `Error ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function getToken() {
  return localStorage.getItem('token');
}

function setSession(token, user) {
  localStorage.setItem('token', token);
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function loginRequest(email, password) {
  return apiRequest('/auth/login', { method: 'POST', body: { email, password } });
}

function fetchMe(token) {
  return apiRequest('/auth/me', { token: token || getToken() });
}

function logoutRequest(token) {
  return apiRequest('/auth/logout', { method: 'POST', token: token || getToken() });
}

function getNotes(token) {
  return apiRequest('/notes', { token: token || getToken() });
}

function createNote(noteData, token) {
  return apiRequest('/notes', { method: 'POST', body: noteData, token: token || getToken() });
}

function updateNote(id, noteData, token) {
  return apiRequest(`/notes/${id}`, { method: 'PUT', body: noteData, token: token || getToken() });
}

function deleteNote(id, token) {
  return apiRequest(`/notes/${id}`, { method: 'DELETE', token: token || getToken() });
}

function updateNotePosition(id, positionData, token) {
  return apiRequest(`/notes/${id}/position`, {
    method: 'PATCH',
    body: positionData,
    token: token || getToken(),
  });
}

function getDashboardMetrics(token) {
  return apiRequest('/dashboard/metrics', { token: token || getToken() });
}

function getUsers(token) {
  return apiRequest('/users', { token: token || getToken() });
}

function createUser(userData, token) {
  return apiRequest('/users', { method: 'POST', body: userData, token: token || getToken() });
}

function updateUser(id, userData, token) {
  return apiRequest(`/users/${id}`, { method: 'PUT', body: userData, token: token || getToken() });
}

function updateUserStatus(id, isActive, token) {
  return apiRequest(`/users/${id}/status`, {
    method: 'PATCH',
    body: { is_active: isActive },
    token: token || getToken(),
  });
}
