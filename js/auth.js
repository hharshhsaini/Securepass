/**
 * SecurePass Auth Handler
 * Handles login and registration forms
 */

// Storage keys
const SESSION_KEY = 'securepass_session';
const USERS_KEY = 'securepass_users';

// API available flag
let apiAvailable = false;

// ============ INIT ============

document.addEventListener('DOMContentLoaded', async function () {
  console.log('Auth.js loading...');

  // Check if API is available
  if (window.SecurePassAPI) {
    try {
      apiAvailable = await window.SecurePassAPI.checkHealth();
      console.log('API health check:', apiAvailable ? 'OK' : 'Failed');
    } catch (e) {
      apiAvailable = false;
    }
  }

  // Check if already logged in
  const session = getSession();
  const path = window.location.pathname;

  if (session) {
    if (path.includes('login.html') || path.includes('register.html')) {
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

  console.log('Auth.js ready');
});

// ============ LOGIN ============

async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const btn = e.target.querySelector('.auth-btn');
  setLoading(btn, true);
  clearError();

  try {
    if (apiAvailable && window.SecurePassAPI) {
      const result = await window.SecurePassAPI.login(email, password);

      // Save session
      saveSession({
        userId: result.user.id,
        email: result.user.email,
        name: result.user.name,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      window.location.href = 'dashboard.html';
    } else {
      // Demo mode
      await delay(500);
      const users = getUsers();
      const user = users.find(u => u.email === email);

      if (!user) {
        showError('No account found with this email');
        setLoading(btn, false);
        return;
      }

      if (user.password !== hashPassword(password)) {
        showError('Incorrect password');
        setLoading(btn, false);
        return;
      }

      saveSession({
        userId: user.id,
        email: user.email,
        name: user.name,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      window.location.href = 'dashboard.html';
    }
  } catch (error) {
    showError(error.message || 'Login failed');
    setLoading(btn, false);
  }
}

// ============ REGISTER ============

async function handleRegister(e) {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const terms = document.getElementById('terms')?.checked;

  const btn = e.target.querySelector('.auth-btn');
  setLoading(btn, true);
  clearError();

  // Validation
  if (!name || name.length < 2) {
    showError('Please enter your name');
    setLoading(btn, false);
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('Please enter a valid email');
    setLoading(btn, false);
    return;
  }

  if (password.length < 8) {
    showError('Password must be at least 8 characters');
    setLoading(btn, false);
    return;
  }

  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    showError('Password must contain uppercase, lowercase, and numbers');
    setLoading(btn, false);
    return;
  }

  if (password !== confirmPassword) {
    showError('Passwords do not match');
    setLoading(btn, false);
    return;
  }

  if (!terms) {
    showError('Please agree to the Terms of Service');
    setLoading(btn, false);
    return;
  }

  try {
    if (apiAvailable && window.SecurePassAPI) {
      const result = await window.SecurePassAPI.register(email, password, name);

      saveSession({
        userId: result.user.id,
        email: result.user.email,
        name: result.user.name,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      window.location.href = 'dashboard.html';
    } else {
      // Demo mode
      await delay(500);
      const users = getUsers();

      if (users.find(u => u.email === email)) {
        showError('Email already registered');
        setLoading(btn, false);
        return;
      }

      const newUser = {
        id: 'user_' + Math.random().toString(36).substr(2, 9),
        name: name,
        email: email,
        password: hashPassword(password),
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      saveUsers(users);

      saveSession({
        userId: newUser.id,
        email: newUser.email,
        name: newUser.name,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      window.location.href = 'dashboard.html';
    }
  } catch (error) {
    showError(error.message || 'Registration failed');
    setLoading(btn, false);
  }
}

// ============ PASSWORD STRENGTH ============

function setupPasswordStrength() {
  const passwordInput = document.getElementById('password');
  const strengthBar = document.getElementById('strengthBar');

  if (!passwordInput || !strengthBar) return;

  passwordInput.addEventListener('input', function () {
    const password = this.value;
    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

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

// ============ HELPERS ============

function getSession() {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    const session = JSON.parse(data);
    if (new Date(session.expiresAt) < new Date()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch (e) {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getUsers() {
  try {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) - hash) + password.charCodeAt(i);
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(16);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showError(message) {
  clearError();
  const error = document.createElement('div');
  error.className = 'auth-error';
  error.textContent = message;
  const form = document.querySelector('.auth-form');
  if (form && form.parentElement) {
    form.parentElement.insertBefore(error, form);
  }
  setTimeout(() => error.remove(), 5000);
}

function clearError() {
  const error = document.querySelector('.auth-error');
  if (error) error.remove();
}

function setLoading(btn, loading) {
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.spinner');
  btn.disabled = loading;
  if (text) text.style.opacity = loading ? '0.5' : '1';
  if (spinner) spinner.classList.toggle('hidden', !loading);
}

// Toggle password visibility
function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  const btn = input?.parentElement?.querySelector('.toggle-password');
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
    if (btn) btn.textContent = input.type === 'password' ? '👁️' : '🙈';
  }
}

// Export for global use
window.togglePassword = togglePassword;
window.SecurePassAuth = {
  getSession: getSession,
  saveSession: saveSession,
  isApiAvailable: function () { return apiAvailable; }
};

console.log('Auth.js loaded');
