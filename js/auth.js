/**
 * Auth.js - Authentication System
 * Handles login, register, and session management
 * Uses localStorage for demo (replace with real API for production)
 */

// Storage keys
const USERS_KEY = 'securepass_users';
const SESSION_KEY = 'securepass_session';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check if already logged in
  const session = getSession();
  if (session && window.location.pathname.includes('login.html') || 
      session && window.location.pathname.includes('register.html')) {
    window.location.href = 'dashboard.html';
    return;
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
  
  // Simulate API delay
  await delay(800);
  
  try {
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
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 1 day
    };
    
    saveSession(session);
    
    // Redirect to dashboard
    window.location.href = 'dashboard.html';
    
  } catch (error) {
    console.error('Login error:', error);
    showAuthError('Something went wrong. Please try again.');
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
  
  // Simulate API delay
  await delay(800);
  
  try {
    const users = getUsers();
    
    // Check if email exists
    if (users.find(u => u.email === email)) {
      showAuthError('An account with this email already exists');
      setButtonLoading(btn, false);
      return;
    }
    
    // Create user
    const newUser = {
      id: generateId(),
      name,
      email,
      password: hashPassword(password),
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveUsers(users);
    
    // Create session
    const session = {
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    saveSession(session);
    
    // Redirect to dashboard
    window.location.href = 'dashboard.html';
    
  } catch (error) {
    console.error('Register error:', error);
    showAuthError('Something went wrong. Please try again.');
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
  // Remove existing error
  const existingError = document.querySelector('.auth-error');
  if (existingError) existingError.remove();
  
  // Create error element
  const error = document.createElement('div');
  error.className = 'auth-error';
  error.textContent = message;
  
  // Insert before form
  const form = document.querySelector('.auth-form');
  form.parentElement.insertBefore(error, form);
  
  // Remove after 5 seconds
  setTimeout(() => error.remove(), 5000);
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

// ============ Storage Helpers ============

function getUsers() {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession() {
  const data = localStorage.getItem(SESSION_KEY);
  if (!data) return null;
  
  const session = JSON.parse(data);
  
  // Check if expired
  if (new Date(session.expiresAt) < new Date()) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  
  return session;
}

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ============ Utility Functions ============

function generateId() {
  return 'user_' + Math.random().toString(36).substr(2, 9);
}

function hashPassword(password) {
  // Simple hash for demo - use bcrypt in production!
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
  getUsers
};
