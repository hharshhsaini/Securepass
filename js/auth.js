/**
 * Auth.js - Authentication System
 * 
 * Supports two modes:
 * 1. API Mode: Uses backend API with JWT tokens (production)
 * 2. Demo Mode: Uses localStorage (when backend unavailable)
 */

// Configuration
const USE_API = true; // Set to false to use demo mode
const API_AVAILABLE_KEY = 'securepass_api_available';

// Storage keys (demo mode)
const USERS_KEY = 'securepass_users';
const SESSION_KEY = 'securepass_session';

// Track if API is available
let apiAvailable = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Check API availability
  if (USE_API && window.SecurePassAPI) {
    try {
      apiAvailable = await window.SecurePassAPI.checkHealth();
      sessionStorage.setItem(API_AVAILABLE_KEY, apiAvailable ? 'true' : 'false');
    } catch {
      apiAvailable = false;
    }
  }
  
  // Check if already logged in
  const session = await getSession();
  const currentPath = window.location.pathname;
  
  if (session) {
    if (currentPath.includes('login.html') || currentPath.includes('register.html')) {
      window.location.href = 'dashboard.html';
      return;
    }
  }

  // Setup forms
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
    setupPasswordStrength();
  }
});

/**
 * Handle login form submission
 */
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const remember = document.getElementById('remember')?.checked;
  
  const btn = e.target.querySelector('.auth-btn');
  setButtonLoading(btn, true);
  clearAuthError();
  
  try {
    if (apiAvailable && window.SecurePassAPI) {
      // API Mode
      const result = await window.SecurePassAPI.login(email, password);
      
      // Store user info for dashboard
      if (result.user) {
        sessionStorage.setItem('securepass_user', JSON.stringify(result.user));
      }
      
      window.location.href = 'dashboard.html';
    } else {
      // Demo Mode
      await delay(800);
      
      const users = getUsers();
      const user = users.find(u => u.email === email);
      
      if (!user) {
        showAuthError('No account found with this email');
        setButtonLoading(btn, false);
        return;
      }
      
      if (user.password !== hashPassword(password)) {
        showAuthError('Incorrect password');
        setButtonLoading(btn, false);
        return;
      }
      
      // Create session
      const session = {
        userId: user.id,
        email: user.email,
        name: user.name,
        createdAt: new Date().toISOString(),
        expiresAt: remember 
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      
      saveSession(session);
      window.location.href = 'dashboard.html';
    }
  } catch (error) {
    console.error('Login error:', error);
    showAuthError(error.message || 'Something went wrong. Please try again.');
    setButtonLoading(btn, false);
  }
}

/**
 * Handle register form submission
 */
async function handleRegister(e) {
  e.preventDefault();
  
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const terms = document.getElementById('terms')?.checked;
  
  const btn = e.target.querySelector('.auth-btn');
  setButtonLoading(btn, true);
  clearAuthError();
  
  // Validation
  if (!name || name.length < 2) {
    showAuthError('Please enter your name');
    setButtonLoading(btn, false);
    return;
  }
  
  if (!isValidEmail(email)) {
    showAuthError('Please enter a valid email');
    setButtonLoading(btn, false);
    return;
  }
  
  if (password.length < 8) {
    showAuthError('Password must be at least 8 characters');
    setButtonLoading(btn, false);
    return;
  }
  
  if (!/[A-Z]/.test(password)) {
    showAuthError('Password must contain at least one uppercase letter');
    setButtonLoading(btn, false);
    return;
  }
  
  if (!/[a-z]/.test(password)) {
    showAuthError('Password must contain at least one lowercase letter');
    setButtonLoading(btn, false);
    return;
  }
  
  if (!/[0-9]/.test(password)) {
    showAuthError('Password must contain at least one number');
    setButtonLoading(btn, false);
    return;
  }
  
  if (password !== confirmPassword) {
    showAuthError('Passwords do not match');
    setButtonLoading(btn, false);
    return;
  }
  
  if (!terms) {
    showAuthError('Please agree to the Terms of Service');
    setButtonLoading(btn, false);
    return;
  }
  
  try {
    if (apiAvailable && window.SecurePassAPI) {
      // API Mode
      const result = await window.SecurePassAPI.register(email, password, name);
      
      // Store user info for dashboard
      if (result.user) {
        sessionStorage.setItem('securepass_user', JSON.stringify(result.user));
      }
      
      window.location.href = 'dashboard.html';
    } else {
      // Demo Mode
      await delay(800);
      
      const users = getUsers();
      
      if (users.find(u => u.email === email)) {
        showAuthError('An account with this email already exists');
        setButtonLoading(btn, false);
        return;
      }
      
      const newUser = {
        id: generateId(),
        name,
        email,
        password: hashPassword(password),
        createdAt: new Date().toISOString()
      };
      
      users.push(newUser);
      saveUsers(users);
      
      const session = {
        userId: newUser.id,
        email: newUser.email,
        name: newUser.name,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      
      saveSession(session);
      window.location.href = 'dashboard.html';
    }
  } catch (error) {
    console.error('Register error:', error);
    showAuthError(error.message || 'Something went wrong. Please try again.');
    setButtonLoading(btn, false);
  }
}

/**
 * Setup password strength indicator
 */
function setupPasswordStrength() {
  const passwordInput = document.getElementById('password');
  const strengthBar = document.getElementById('strengthBar');
  
  if (!passwordInput || !strengthBar) return;
  
  passwordInput.addEventListener('input', () => {
    const password = passwordInput.value;
    const strength = calculatePasswordStrength(password);
    
    strengthBar.className = 'strength-bar';
    if (password.length === 0) {
      strengthBar.style.width = '0';
    } else if (strength < 3) {
      strengthBar.classList.add('weak');
    } else if (strength < 5) {
      strengthBar.classList.add('medium');
    } else {
      strengthBar.classList.add('strong');
    }
  });
}

/**
 * Calculate password strength (0-6)
 */
function calculatePasswordStrength(password) {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  return strength;
}

/**
 * Toggle password visibility
 */
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const btn = input.parentElement.querySelector('.toggle-password');
  
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}

/**
 * Show auth error message
 */
function showAuthError(message) {
  clearAuthError();
  
  const error = document.createElement('div');
  error.className = 'auth-error';
  error.textContent = message;
  
  const form = document.querySelector('.auth-form');
  form.parentElement.insertBefore(error, form);
  
  setTimeout(() => error.remove(), 5000);
}

/**
 * Clear auth error message
 */
function clearAuthError() {
  const existingError = document.querySelector('.auth-error');
  if (existingError) existingError.remove();
}

/**
 * Set button loading state
 */
function setButtonLoading(btn, loading) {
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.spinner');
  
  if (loading) {
    btn.disabled = true;
    text.style.opacity = '0.5';
    spinner?.classList.remove('hidden');
  } else {
    btn.disabled = false;
    text.style.opacity = '1';
    spinner?.classList.add('hidden');
  }
}

// ============ Session Management ============

async function getSession() {
  // Check API mode first
  if (apiAvailable && window.SecurePassAPI) {
    try {
      const result = await window.SecurePassAPI.refreshAccessToken();
      if (result && result.user) {
        return {
          userId: result.user.id,
          email: result.user.email,
          name: result.user.name
        };
      }
    } catch {
      return null;
    }
  }
  
  // Demo mode fallback
  const data = localStorage.getItem(SESSION_KEY);
  if (!data) return null;
  
  const session = JSON.parse(data);
  
  if (new Date(session.expiresAt) < new Date()) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  
  return session;
}

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function clearSession() {
  if (apiAvailable && window.SecurePassAPI) {
    await window.SecurePassAPI.logout();
  }
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('securepass_user');
}

// ============ Demo Mode Storage ============

function getUsers() {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// ============ Utility Functions ============

function generateId() {
  return 'user_' + Math.random().toString(36).substr(2, 9);
}

function hashPassword(password) {
  // Simple hash for demo - backend uses bcrypt
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(16);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export for use in other files
window.SecurePassAuth = {
  getSession,
  clearSession,
  getUsers,
  isApiAvailable: () => apiAvailable
};
