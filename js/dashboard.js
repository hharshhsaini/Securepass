/**
 * Dashboard.js - User Dashboard Functionality
 * Handles vault management, password generation, and user settings
 */

// Storage keys
const SESSION_KEY = 'securepass_session';
const VAULT_KEY = 'securepass_vault';
const USERS_KEY = 'securepass_users';

// Current state
let currentUser = null;
let currentPassword = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  const session = getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }
  
  currentUser = session;
  
  // Setup UI
  setupNavigation();
  setupUserInfo();
  setupLogout();
  setupGenerator();
  setupVault();
  setupSettings();
  setupSaveModal();
  
  // Load initial data
  loadOverviewStats();
  loadVault();
  loadRecentPasswords();
});

// ============ Navigation ============

function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.dataset.tab;
      switchTab(tab);
    });
  });
}

function switchTab(tabName) {
  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.tab === tabName);
  });
  
  // Update tabs
  document.querySelectorAll('.dashboard-tab').forEach(tab => {
    tab.classList.toggle('active', tab.id === tabName);
  });
}

// ============ User Info ============

function setupUserInfo() {
  const userName = document.getElementById('userName');
  const welcomeName = document.getElementById('welcomeName');
  const settingsName = document.getElementById('settingsName');
  const settingsEmail = document.getElementById('settingsEmail');
  
  if (userName) userName.textContent = currentUser.name;
  if (welcomeName) welcomeName.textContent = currentUser.name.split(' ')[0];
  if (settingsName) settingsName.value = currentUser.name;
  if (settingsEmail) settingsEmail.value = currentUser.email;
}

function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearSession();
      window.location.href = 'index.html';
    });
  }
}

// ============ Overview Stats ============

function loadOverviewStats() {
  const vault = getVault();
  const userVault = vault.filter(v => v.userId === currentUser.userId);
  
  // Total passwords
  const totalEl = document.getElementById('totalPasswords');
  if (totalEl) totalEl.textContent = userVault.length;
  
  // Strong passwords (length >= 12 and has symbols)
  const strongCount = userVault.filter(v => 
    v.password.length >= 12 && /[^a-zA-Z0-9]/.test(v.password)
  ).length;
  const strongEl = document.getElementById('strongPasswords');
  if (strongEl) strongEl.textContent = strongCount;
  
  // Weak passwords
  const weakCount = userVault.filter(v => v.password.length < 10).length;
  const weakEl = document.getElementById('weakPasswords');
  if (weakEl) weakEl.textContent = weakCount;
  
  // Last generated
  const lastEl = document.getElementById('lastGenerated');
  if (lastEl) {
    if (userVault.length > 0) {
      const sorted = [...userVault].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      lastEl.textContent = formatDate(sorted[0].createdAt);
    } else {
      lastEl.textContent = 'Never';
    }
  }
}

function loadRecentPasswords() {
  const vault = getVault();
  const userVault = vault.filter(v => v.userId === currentUser.userId);
  const recent = userVault
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  
  const container = document.getElementById('recentList');
  if (!container) return;
  
  if (recent.length === 0) {
    container.innerHTML = '<p class="empty-state">No passwords saved yet. Generate one to get started!</p>';
    return;
  }
  
  container.innerHTML = recent.map(item => `
    <div class="vault-item">
      <div class="vault-item-info">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.username || item.site || 'No details')}</p>
      </div>
      <div class="vault-item-actions">
        <button onclick="copyPassword('${item.id}')" title="Copy">📋</button>
        <button onclick="viewPassword('${item.id}')" title="View">👁️</button>
      </div>
    </div>
  `).join('');
}

// ============ Vault ============

function setupVault() {
  const searchInput = document.getElementById('vaultSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      loadVault(e.target.value);
    });
  }
}

function loadVault(searchQuery = '') {
  const vault = getVault();
  let userVault = vault.filter(v => v.userId === currentUser.userId);
  
  // Filter by search
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    userVault = userVault.filter(v => 
      v.title.toLowerCase().includes(query) ||
      (v.username && v.username.toLowerCase().includes(query)) ||
      (v.site && v.site.toLowerCase().includes(query))
    );
  }
  
  // Sort by date
  userVault.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const container = document.getElementById('vaultList');
  if (!container) return;
  
  if (userVault.length === 0) {
    container.innerHTML = searchQuery 
      ? '<p class="empty-state">No passwords match your search.</p>'
      : '<p class="empty-state">Your vault is empty. Save your first password!</p>';
    return;
  }
  
  container.innerHTML = userVault.map(item => `
    <div class="vault-item" data-id="${item.id}">
      <div class="vault-item-info">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.username || '')} ${item.site ? '• ' + escapeHtml(item.site) : ''}</p>
        <div class="vault-item-password" id="pwd-${item.id}">••••••••••••</div>
      </div>
      <div class="vault-item-actions">
        <button onclick="copyPassword('${item.id}')" title="Copy password">📋</button>
        <button onclick="toggleVaultPassword('${item.id}')" title="Show/hide">👁️</button>
        <button onclick="editPassword('${item.id}')" title="Edit">✏️</button>
        <button onclick="deletePassword('${item.id}')" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
}

function toggleVaultPassword(id) {
  const vault = getVault();
  const item = vault.find(v => v.id === id);
  if (!item) return;
  
  const el = document.getElementById(`pwd-${id}`);
  if (el.textContent === '••••••••••••') {
    el.textContent = item.password;
  } else {
    el.textContent = '••••••••••••';
  }
}

function copyPassword(id) {
  const vault = getVault();
  const item = vault.find(v => v.id === id);
  if (!item) return;
  
  navigator.clipboard.writeText(item.password);
  showToast('Password copied!', 'success');
}

function viewPassword(id) {
  switchTab('vault');
  setTimeout(() => toggleVaultPassword(id), 100);
}

function editPassword(id) {
  const vault = getVault();
  const item = vault.find(v => v.id === id);
  if (!item) return;
  
  // Fill modal with existing data
  document.getElementById('saveTitle').value = item.title;
  document.getElementById('saveUsername').value = item.username || '';
  document.getElementById('saveSite').value = item.site || '';
  document.getElementById('savePassword').value = item.password;
  document.getElementById('saveNotes').value = item.notes || '';
  
  // Store edit ID
  document.getElementById('savePasswordForm').dataset.editId = id;
  
  openSaveModal();
}

function deletePassword(id) {
  if (!confirm('Are you sure you want to delete this password?')) return;
  
  let vault = getVault();
  vault = vault.filter(v => v.id !== id);
  saveVault(vault);
  
  loadVault();
  loadOverviewStats();
  loadRecentPasswords();
  showToast('Password deleted', 'success');
}

// ============ Generator ============

function setupGenerator() {
  const lengthSlider = document.getElementById('genLength');
  const lengthValue = document.getElementById('lengthValue');
  
  if (lengthSlider && lengthValue) {
    lengthSlider.addEventListener('input', () => {
      lengthValue.textContent = lengthSlider.value;
    });
  }
}

function generateDashboardPassword() {
  const length = parseInt(document.getElementById('genLength')?.value || 16);
  const useUpper = document.getElementById('genUpper')?.checked ?? true;
  const useLower = document.getElementById('genLower')?.checked ?? true;
  const useNumbers = document.getElementById('genNumbers')?.checked ?? true;
  const useSymbols = document.getElementById('genSymbols')?.checked ?? true;
  
  let charset = '';
  if (useUpper) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (useLower) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (useNumbers) charset += '0123456789';
  if (useSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  if (!charset) charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
  
  let password = '';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  
  currentPassword = password;
  
  const output = document.getElementById('generatedPassword');
  if (output) output.value = password;
  
  showToast('Password generated!', 'success');
}

function copyGeneratedPassword() {
  const password = document.getElementById('generatedPassword')?.value;
  if (!password) {
    showToast('Generate a password first', 'error');
    return;
  }
  
  navigator.clipboard.writeText(password);
  showToast('Password copied!', 'success');
}

function toggleGeneratedVisibility() {
  const input = document.getElementById('generatedPassword');
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}

// ============ Save Modal ============

function setupSaveModal() {
  const form = document.getElementById('savePasswordForm');
  if (form) {
    form.addEventListener('submit', handleSavePassword);
  }
}

function openSaveModal() {
  const modal = document.getElementById('saveModal');
  if (!modal) return;
  
  // Pre-fill password if generated
  const passwordInput = document.getElementById('savePassword');
  if (passwordInput && currentPassword && !passwordInput.value) {
    passwordInput.value = currentPassword;
  }
  
  modal.showModal();
}

function closeSaveModal() {
  const modal = document.getElementById('saveModal');
  const form = document.getElementById('savePasswordForm');
  
  if (modal) modal.close();
  if (form) {
    form.reset();
    delete form.dataset.editId;
  }
  currentPassword = '';
}

function handleSavePassword(e) {
  e.preventDefault();
  
  const form = e.target;
  const editId = form.dataset.editId;
  
  const title = document.getElementById('saveTitle').value.trim();
  const username = document.getElementById('saveUsername').value.trim();
  const site = document.getElementById('saveSite').value.trim();
  const password = document.getElementById('savePassword').value;
  const notes = document.getElementById('saveNotes').value.trim();
  
  if (!title || !password) {
    showToast('Title and password are required', 'error');
    return;
  }
  
  let vault = getVault();
  
  if (editId) {
    // Update existing
    const index = vault.findIndex(v => v.id === editId);
    if (index !== -1) {
      vault[index] = {
        ...vault[index],
        title,
        username,
        site,
        password,
        notes,
        updatedAt: new Date().toISOString()
      };
    }
    showToast('Password updated!', 'success');
  } else {
    // Create new
    vault.push({
      id: 'pwd_' + Math.random().toString(36).substr(2, 9),
      userId: currentUser.userId,
      title,
      username,
      site,
      password,
      notes,
      createdAt: new Date().toISOString()
    });
    showToast('Password saved to vault!', 'success');
  }
  
  saveVault(vault);
  closeSaveModal();
  
  loadVault();
  loadOverviewStats();
  loadRecentPasswords();
}

// ============ Settings ============

function setupSettings() {
  // Settings are handled by inline onclick handlers
}

function updateProfile() {
  const name = document.getElementById('settingsName').value.trim();
  
  if (!name) {
    showToast('Name is required', 'error');
    return;
  }
  
  // Update user in storage
  let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  const index = users.findIndex(u => u.id === currentUser.userId);
  if (index !== -1) {
    users[index].name = name;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  
  // Update session
  currentUser.name = name;
  saveSession(currentUser);
  
  // Update UI
  setupUserInfo();
  
  showToast('Profile updated!', 'success');
}

function changePassword() {
  const current = document.getElementById('currentPassword').value;
  const newPwd = document.getElementById('newPassword').value;
  
  if (!current || !newPwd) {
    showToast('Please fill in both fields', 'error');
    return;
  }
  
  if (newPwd.length < 8) {
    showToast('New password must be at least 8 characters', 'error');
    return;
  }
  
  // Verify current password
  let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  const user = users.find(u => u.id === currentUser.userId);
  
  if (!user || user.password !== hashPassword(current)) {
    showToast('Current password is incorrect', 'error');
    return;
  }
  
  // Update password
  user.password = hashPassword(newPwd);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  
  // Clear form
  document.getElementById('currentPassword').value = '';
  document.getElementById('newPassword').value = '';
  
  showToast('Password changed successfully!', 'success');
}

function deleteAccount() {
  if (!confirm('Are you sure? This will delete all your data permanently.')) return;
  if (!confirm('This action cannot be undone. Continue?')) return;
  
  // Remove user
  let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  users = users.filter(u => u.id !== currentUser.userId);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  
  // Remove user's vault entries
  let vault = getVault();
  vault = vault.filter(v => v.userId !== currentUser.userId);
  saveVault(vault);
  
  // Clear session
  clearSession();
  
  // Redirect
  window.location.href = 'index.html';
}

// ============ Storage Helpers ============

function getSession() {
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

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function getVault() {
  const data = localStorage.getItem(VAULT_KEY);
  return data ? JSON.parse(data) : [];
}

function saveVault(vault) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

// ============ Utility Functions ============

function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(16);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
  
  return date.toLocaleDateString();
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()">✕</button>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => toast.remove(), 3000);
}

// Make functions globally available
window.switchTab = switchTab;
window.copyPassword = copyPassword;
window.viewPassword = viewPassword;
window.toggleVaultPassword = toggleVaultPassword;
window.editPassword = editPassword;
window.deletePassword = deletePassword;
window.generateDashboardPassword = generateDashboardPassword;
window.copyGeneratedPassword = copyGeneratedPassword;
window.toggleGeneratedVisibility = toggleGeneratedVisibility;
window.openSaveModal = openSaveModal;
window.closeSaveModal = closeSaveModal;
window.updateProfile = updateProfile;
window.changePassword = changePassword;
window.deleteAccount = deleteAccount;
