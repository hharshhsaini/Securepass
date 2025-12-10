/**
 * API Client for SecurePass Backend
 * 
 * Handles all communication with the backend API including:
 * - Authentication (login, register, OAuth)
 * - Token management (access token refresh)
 * - Password vault CRUD operations
 */

// API Configuration
const API_BASE_URL = 'http://localhost:4000/api';

// Token storage (in memory for security - not localStorage)
let accessToken = null;

/**
 * Initialize API client - check for existing session
 */
export async function initAPI() {
  // Try to refresh token on page load (uses httpOnly cookie)
  try {
    const result = await refreshAccessToken();
    return result;
  } catch {
    return null;
  }
}

/**
 * Get current access token
 */
export function getAccessToken() {
  return accessToken;
}

/**
 * Set access token (used after login/register)
 */
export function setAccessToken(token) {
  accessToken = token;
}

/**
 * Clear access token (used on logout)
 */
export function clearAccessToken() {
  accessToken = null;
}

/**
 * Make authenticated API request with automatic token refresh
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // Add auth header if we have a token
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include' // Include cookies for refresh token
  });
  
  // Handle token expiration
  if (response.status === 401) {
    const data = await response.json().catch(() => ({}));
    
    // Try to refresh token
    if (data.code === 'TOKEN_EXPIRED' || !accessToken) {
      try {
        await refreshAccessToken();
        // Retry original request with new token
        headers['Authorization'] = `Bearer ${accessToken}`;
        return fetch(url, { ...options, headers, credentials: 'include' });
      } catch {
        // Refresh failed - clear token and throw
        clearAccessToken();
        throw new Error('Session expired. Please login again.');
      }
    }
    
    throw new Error(data.error || 'Unauthorized');
  }
  
  return response;
}

// ============================================
// Authentication Endpoints
// ============================================

/**
 * Register a new user
 */
export async function register(email, password, name) {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, name })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Registration failed');
  }
  
  // Store access token in memory
  accessToken = data.accessToken;
  
  return data;
}

/**
 * Login with email/password
 */
export async function login(email, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }
  
  // Store access token in memory
  accessToken = data.accessToken;
  
  return data;
}

/**
 * Logout - clears session
 */
export async function logout() {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch {
    // Ignore errors - still clear local state
  }
  
  clearAccessToken();
}

/**
 * Refresh access token using httpOnly cookie
 */
export async function refreshAccessToken() {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error('Token refresh failed');
  }
  
  const data = await response.json();
  accessToken = data.accessToken;
  
  return data;
}

/**
 * Get current user profile
 */
export async function getCurrentUser() {
  const response = await apiRequest('/auth/me');
  
  if (!response.ok) {
    throw new Error('Failed to get user');
  }
  
  return response.json();
}

/**
 * Get OAuth login URL
 */
export function getOAuthURL(provider) {
  return `${API_BASE_URL}/auth/${provider}`;
}

/**
 * Initiate Google OAuth login
 */
export function loginWithGoogle() {
  window.location.href = getOAuthURL('google');
}

/**
 * Initiate GitHub OAuth login
 */
export function loginWithGitHub() {
  window.location.href = getOAuthURL('github');
}

// ============================================
// Password Vault Endpoints
// ============================================

/**
 * Get all password entries (list view - no passwords)
 */
export async function getPasswords() {
  const response = await apiRequest('/passwords');
  
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch passwords');
  }
  
  const data = await response.json();
  return data.entries;
}

/**
 * Get a single password entry with decrypted password
 */
export async function getPassword(id) {
  const response = await apiRequest(`/passwords/${id}`);
  
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch password');
  }
  
  const data = await response.json();
  return data.entry;
}

/**
 * Create a new password entry
 */
export async function createPassword(entry) {
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

/**
 * Update a password entry
 */
export async function updatePassword(id, updates) {
  const response = await apiRequest(`/passwords/${id}`, {
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

/**
 * Delete a password entry
 */
export async function deletePassword(id) {
  const response = await apiRequest(`/passwords/${id}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete password');
  }
  
  return true;
}

// ============================================
// Health Check
// ============================================

/**
 * Check if backend is available
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// Export for global access
window.SecurePassAPI = {
  initAPI,
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  register,
  login,
  logout,
  refreshAccessToken,
  getCurrentUser,
  getOAuthURL,
  loginWithGoogle,
  loginWithGitHub,
  getPasswords,
  getPassword,
  createPassword,
  updatePassword,
  deletePassword,
  checkHealth
};
