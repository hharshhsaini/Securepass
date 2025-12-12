/**
 * SecurePass API Client
 * Complete client for all backend features including:
 * - Authentication
 * - Vault CRUD with search, favorites, pinning
 * - Collections (folders)
 * - Tags
 * - Sharing
 * - Audit logs
 * - Password health
 */

// Configuration
const API_BASE = 'http://localhost:4000/api';

// Token storage (in memory)
let accessToken = null;

// ============ INIT ============

async function initAPI() {
  try {
    const result = await refreshAccessToken();
    console.log('API: Token refreshed successfully');
    return result;
  } catch (e) {
    console.log('API: No existing session');
    return null;
  }
}

// ============ AUTH ============

async function register(email, password, name) {
  const response = await fetch(API_BASE + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, name })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Registration failed');

  accessToken = data.accessToken;
  return data;
}

async function login(email, password) {
  const response = await fetch(API_BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Login failed');

  accessToken = data.accessToken;
  return data;
}

async function logout() {
  try {
    await fetch(API_BASE + '/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (e) { }
  accessToken = null;
}

async function refreshAccessToken() {
  const response = await fetch(API_BASE + '/auth/refresh', {
    method: 'POST',
    credentials: 'include'
  });

  if (!response.ok) throw new Error('Token refresh failed');

  const data = await response.json();
  accessToken = data.accessToken;
  return data;
}

async function getCurrentUser() {
  const response = await apiRequest('/auth/me');
  if (!response.ok) throw new Error('Failed to get user');
  return response.json();
}

function loginWithGoogle() {
  window.location.href = API_BASE + '/auth/google';
}

function loginWithGitHub() {
  window.location.href = API_BASE + '/auth/github';
}

// ============ API REQUEST HELPER ============

async function apiRequest(endpoint, options) {
  options = options || {};
  const url = API_BASE + endpoint;

  const headers = {
    'Content-Type': 'application/json'
  };

  if (accessToken) {
    headers['Authorization'] = 'Bearer ' + accessToken;
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: headers,
    body: options.body,
    credentials: 'include'
  });

  // Handle token expiration
  if (response.status === 401 && !options._retry) {
    try {
      await refreshAccessToken();
      options._retry = true;
      return apiRequest(endpoint, options);
    } catch (e) {
      accessToken = null;
      throw new Error('Session expired');
    }
  }

  return response;
}

// ============ PASSWORDS ============

async function getPasswords(options) {
  options = options || {};
  const params = new URLSearchParams();

  if (options.query) params.append('query', options.query);
  if (options.collectionId) params.append('collectionId', options.collectionId);
  if (options.tagIds) params.append('tagIds', options.tagIds.join(','));
  if (options.isFavorite !== undefined) params.append('isFavorite', options.isFavorite);
  if (options.isPinned !== undefined) params.append('isPinned', options.isPinned);

  const queryString = params.toString();
  const endpoint = '/passwords' + (queryString ? '?' + queryString : '');

  const response = await apiRequest(endpoint);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch passwords');
  }
  const data = await response.json();
  return data.entries || [];
}

async function getPassword(id) {
  const response = await apiRequest('/passwords/' + id);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch password');
  }
  const data = await response.json();
  return data.entry;
}

async function createPassword(entry) {
  const response = await apiRequest('/passwords', {
    method: 'POST',
    body: JSON.stringify(entry)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to create password');
  }
  const data = await response.json();
  return data.entry;
}

async function updatePassword(id, updates) {
  const response = await apiRequest('/passwords/' + id, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update password');
  }
  const data = await response.json();
  return data.entry;
}

async function deletePassword(id) {
  const response = await apiRequest('/passwords/' + id, {
    method: 'DELETE'
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete password');
  }
  return true;
}

async function directSave(entry) {
  const response = await apiRequest('/passwords/direct-save', {
    method: 'POST',
    body: JSON.stringify(entry)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save');
  }
  const data = await response.json();
  return data.entry;
}

async function toggleFavorite(id) {
  const response = await apiRequest('/passwords/' + id + '/favorite', {
    method: 'POST'
  });
  if (!response.ok) throw new Error('Failed to toggle favorite');
  const data = await response.json();
  return data.isFavorite;
}

async function togglePinned(id) {
  const response = await apiRequest('/passwords/' + id + '/pin', {
    method: 'POST'
  });
  if (!response.ok) throw new Error('Failed to toggle pin');
  const data = await response.json();
  return data.isPinned;
}

async function bulkDeletePasswords(entryIds) {
  const response = await apiRequest('/passwords/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ entryIds })
  });
  if (!response.ok) throw new Error('Bulk delete failed');
  const data = await response.json();
  return data.count;
}

async function getPasswordHealth() {
  const response = await apiRequest('/passwords/health');
  if (!response.ok) throw new Error('Failed to get password health');
  const data = await response.json();
  return data.health;
}

async function exportVault() {
  const response = await apiRequest('/passwords/export');
  if (!response.ok) throw new Error('Export failed');
  const data = await response.json();
  return data.entries;
}

async function importVault(entries) {
  const response = await apiRequest('/passwords/import', {
    method: 'POST',
    body: JSON.stringify({ entries })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Import failed');
  }
  return response.json();
}

// ============ COLLECTIONS ============

async function getCollections() {
  const response = await apiRequest('/collections');
  if (!response.ok) throw new Error('Failed to fetch collections');
  const data = await response.json();
  return data.collections || [];
}

async function createCollection(input) {
  const response = await apiRequest('/collections', {
    method: 'POST',
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error('Failed to create collection');
  const data = await response.json();
  return data.collection;
}

async function updateCollection(id, input) {
  const response = await apiRequest('/collections/' + id, {
    method: 'PUT',
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error('Failed to update collection');
  const data = await response.json();
  return data.collection;
}

async function deleteCollection(id) {
  const response = await apiRequest('/collections/' + id, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete collection');
  return true;
}

async function moveToCollection(entryIds, collectionId) {
  const response = await apiRequest('/collections/' + (collectionId || 'null') + '/entries', {
    method: 'POST',
    body: JSON.stringify({ entryIds })
  });
  if (!response.ok) throw new Error('Failed to move entries');
  const data = await response.json();
  return data.count;
}

// ============ TAGS ============

async function getTags() {
  const response = await apiRequest('/tags');
  if (!response.ok) throw new Error('Failed to fetch tags');
  const data = await response.json();
  return data.tags || [];
}

async function createTag(input) {
  const response = await apiRequest('/tags', {
    method: 'POST',
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error('Failed to create tag');
  const data = await response.json();
  return data.tag;
}

async function deleteTag(id) {
  const response = await apiRequest('/tags/' + id, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to delete tag');
  return true;
}

async function addTagsToEntry(entryId, tagIds) {
  const response = await apiRequest('/tags/entries/' + entryId, {
    method: 'POST',
    body: JSON.stringify({ tagIds })
  });
  if (!response.ok) throw new Error('Failed to add tags');
  return true;
}

// ============ SHARING ============

async function createShareLink(input) {
  const response = await apiRequest('/share', {
    method: 'POST',
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to create share link');
  }
  return response.json();
}

async function getShareLinks() {
  const response = await apiRequest('/share');
  if (!response.ok) throw new Error('Failed to fetch share links');
  const data = await response.json();
  return data.links || [];
}

async function revokeShareLink(id) {
  const response = await apiRequest('/share/' + id, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Failed to revoke share link');
  return true;
}

// ============ AUDIT ============

async function getAuditLogs(options) {
  options = options || {};
  const params = new URLSearchParams();

  if (options.limit) params.append('limit', options.limit);
  if (options.offset) params.append('offset', options.offset);
  if (options.action) params.append('action', options.action);

  const queryString = params.toString();
  const endpoint = '/audit' + (queryString ? '?' + queryString : '');

  const response = await apiRequest(endpoint);
  if (!response.ok) throw new Error('Failed to fetch audit logs');
  return response.json();
}

async function getActivitySummary(days) {
  const response = await apiRequest('/audit/summary?days=' + (days || 7));
  if (!response.ok) throw new Error('Failed to fetch activity summary');
  return response.json();
}

// ============ HEALTH CHECK ============

async function checkHealth() {
  try {
    const response = await fetch(API_BASE.replace('/api', '') + '/health');
    return response.ok;
  } catch (e) {
    return false;
  }
}

// ============ EXPORT TO GLOBAL ============

window.SecurePassAPI = {
  // Init
  initAPI: initAPI,
  checkHealth: checkHealth,

  // Auth
  register: register,
  login: login,
  logout: logout,
  refreshAccessToken: refreshAccessToken,
  getCurrentUser: getCurrentUser,
  loginWithGoogle: loginWithGoogle,
  loginWithGitHub: loginWithGitHub,

  // Passwords
  getPasswords: getPasswords,
  getPassword: getPassword,
  createPassword: createPassword,
  updatePassword: updatePassword,
  deletePassword: deletePassword,
  directSave: directSave,
  toggleFavorite: toggleFavorite,
  togglePinned: togglePinned,
  bulkDeletePasswords: bulkDeletePasswords,
  getPasswordHealth: getPasswordHealth,
  exportVault: exportVault,
  importVault: importVault,

  // Collections
  getCollections: getCollections,
  createCollection: createCollection,
  updateCollection: updateCollection,
  deleteCollection: deleteCollection,
  moveToCollection: moveToCollection,

  // Tags
  getTags: getTags,
  createTag: createTag,
  deleteTag: deleteTag,
  addTagsToEntry: addTagsToEntry,

  // Sharing
  createShareLink: createShareLink,
  getShareLinks: getShareLinks,
  revokeShareLink: revokeShareLink,

  // Audit
  getAuditLogs: getAuditLogs,
  getActivitySummary: getActivitySummary
};

console.log('SecurePassAPI loaded with all features');
