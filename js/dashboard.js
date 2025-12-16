/**
 * Dashboard.js - Complete User Dashboard
 * 
 * Features:
 * - Password generation with strength meter
 * - Quick Save to vault
 * - Vault CRUD with search, favorites, pinning
 * - Collections (folders) management
 * - Tags filtering
 * - Password health dashboard
 * - Bulk operations
 * - Export/Import
 * - Secure sharing
 * - Activity log
 */

// Storage keys
const SESSION_KEY = 'securepass_session';
const VAULT_KEY = 'securepass_vault';

// Current state
let currentUser = null;
let currentPassword = '';
let apiReady = false;
let vaultCache = [];
let collectionsCache = [];
let tagsCache = [];
let selectedEntries = new Set();
let currentFilter = {};

// ============ INITIALIZATION ============

document.addEventListener('DOMContentLoaded', async function () {
  console.log('Dashboard loading...');

  try {
    // Check authentication
    const session = getSession();
    if (!session) {
      console.log('No session, guest mode');
    }

    currentUser = session || {
      name: 'Guest User',
      email: 'guest@local',
      userId: 'guest_' + Math.floor(Math.random() * 1000000),
      isGuest: true
    };
    console.log('User session:', currentUser.name, currentUser.isGuest ? '(Guest)' : '(Authenticated)');

    // Setup UI - Do this FIRST so UI is responsive even if API fails
    setupNavigation();
    setupUserInfo();
    setupLogout();
    setupGenerator();
    setupVaultSearch();
    setupVaultFilters();
    setupSaveModal();
    setupBulkActions();

    // Try to initialize API
    if (window.SecurePassAPI) {
      try {
        const result = await window.SecurePassAPI.initAPI();
        if (result && result.accessToken) {
          apiReady = true;
          console.log('API connected successfully');
        } else {
          console.log('API initialization returned no token, using local mode');
          apiReady = false;
        }
      } catch (e) {
        console.log('API not available, using local storage mode');
        apiReady = false;
      }
    }

    // Load data
    await loadCollections();
    await loadTags();
    await loadOverviewStats();
    await loadVault();
    await loadRecentPasswords();
    await loadPasswordHealth();

    console.log('Dashboard ready!');
  } catch (err) {
    console.error('Critical Dashboard Error:', err);
    alert('Dashboard failed to load: ' + err.message);
  }
});

// Global error handler for runtime errors
window.onerror = function (msg, url, line) {
  console.error('Global Error:', msg, url, line);
  // Optional: showToast('System Error: ' + msg, 'error');
};

// ============ SESSION ============

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

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  if (window.SecurePassAPI) {
    window.SecurePassAPI.logout().catch(() => { });
  }
}

// ============ NAVIGATION ============

function setupNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const tab = this.dataset.tab;
      switchTab(tab);
    });
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.tab === tabName);
  });
  document.querySelectorAll('.dashboard-tab').forEach(tab => {
    tab.classList.toggle('active', tab.id === tabName);
  });
}

// ============ USER INFO ============

function setupUserInfo() {
  const userName = document.getElementById('userName');
  const welcomeName = document.getElementById('welcomeName');
  const settingsName = document.getElementById('settingsName');
  const settingsEmail = document.getElementById('settingsEmail');

  if (userName) userName.textContent = currentUser.name || 'User';
  if (welcomeName) welcomeName.textContent = (currentUser.name || 'User').split(' ')[0];
  if (settingsName) settingsName.value = currentUser.name || '';
  if (settingsEmail) settingsEmail.value = currentUser.email || '';
}

function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      clearSession();
      window.location.href = 'index.html';
    });
  }
}

// ============ OVERVIEW STATS ============

async function loadOverviewStats() {
  const vault = await fetchVault();

  const totalEl = document.getElementById('totalPasswords');
  if (totalEl) totalEl.textContent = vault.length;

  // Count favorites
  const favCount = vault.filter(v => v.isFavorite).length;
  const favEl = document.getElementById('favoriteCount');
  if (favEl) favEl.textContent = favCount;

  // Strong/weak from strength field
  const strongCount = vault.filter(v => v.strength >= 3).length;
  const weakCount = vault.filter(v => v.strength !== null && v.strength < 2).length;

  const strongEl = document.getElementById('strongPasswords');
  const weakEl = document.getElementById('weakPasswords');
  if (strongEl) strongEl.textContent = strongCount;
  if (weakEl) weakEl.textContent = weakCount;

  const lastEl = document.getElementById('lastGenerated');
  if (lastEl) {
    if (vault.length > 0) {
      const sorted = [...vault].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      lastEl.textContent = formatDate(sorted[0].createdAt);
    } else {
      lastEl.textContent = 'Never';
    }
  }
}

async function loadRecentPasswords() {
  const vault = await fetchVault();
  const recent = vault
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
        <h4>${escapeHtml(item.title)} ${item.isFavorite ? '⭐' : ''}</h4>
        <p>${escapeHtml(item.username || item.site || 'No details')}</p>
      </div>
      <div class="vault-item-actions">
        <button onclick="copyPassword('${item.id}')" title="Copy">📋</button>
        <button onclick="viewPassword('${item.id}')" title="View">👁️</button>
      </div>
    </div>
  `).join('');
}

// ============ PASSWORD HEALTH ============

async function loadPasswordHealth() {
  const healthContainer = document.getElementById('healthDashboard');
  if (!healthContainer) return;

  if (apiReady && window.SecurePassAPI) {
    try {
      const health = await window.SecurePassAPI.getPasswordHealth();

      healthContainer.innerHTML = `
        <div class="health-grid">
          <div class="health-card good">
            <span class="health-value">${health.strong}</span>
            <span class="health-label">Strong</span>
          </div>
          <div class="health-card warning">
            <span class="health-value">${health.medium}</span>
            <span class="health-label">Medium</span>
          </div>
          <div class="health-card danger">
            <span class="health-value">${health.weak}</span>
            <span class="health-label">Weak</span>
          </div>
          <div class="health-card danger">
            <span class="health-value">${health.reused}</span>
            <span class="health-label">Reused</span>
          </div>
          <div class="health-card warning">
            <span class="health-value">${health.old}</span>
            <span class="health-label">Old (90+ days)</span>
          </div>
        </div>
      `;
    } catch (e) {
      healthContainer.innerHTML = '<p class="muted">Health analysis unavailable</p>';
    }
  } else {
    healthContainer.innerHTML = '<p class="muted">Connect to backend for health analysis</p>';
  }
}

// ============ COLLECTIONS ============

async function loadCollections() {
  if (apiReady && window.SecurePassAPI) {
    try {
      collectionsCache = await window.SecurePassAPI.getCollections();
      renderCollectionsList();
      renderCollectionFilter();
    } catch (e) {
      console.error('Failed to load collections:', e);
    }
  }
}

function renderCollectionsList() {
  const container = document.getElementById('collectionsList');
  if (!container) return;

  if (collectionsCache.length === 0) {
    container.innerHTML = '<p class="empty-state">No collections yet</p>';
    return;
  }

  container.innerHTML = collectionsCache.map(col => `
    <div class="collection-item" data-id="${col.id}">
      <span class="collection-icon">${col.icon || '📁'}</span>
      <span class="collection-name">${escapeHtml(col.name)}</span>
      <span class="collection-count">${col.entryCount}</span>
      <button onclick="filterByCollection('${col.id}')" class="btn-small">Filter</button>
    </div>
  `).join('');
}

function renderCollectionFilter() {
  const select = document.getElementById('collectionFilter');
  if (!select) return;

  select.innerHTML = '<option value="">All Collections</option>' +
    collectionsCache.map(col =>
      `<option value="${col.id}">${col.icon || '📁'} ${escapeHtml(col.name)}</option>`
    ).join('');
}

async function createNewCollection() {
  const name = prompt('Collection name:');
  if (!name) return;

  const icon = prompt('Icon (emoji):', '📁');

  try {
    const collection = await window.SecurePassAPI.createCollection({ name, icon });
    collectionsCache.push(collection);
    renderCollectionsList();
    renderCollectionFilter();
    showToast('Collection created!', 'success');
  } catch (e) {
    showToast('Failed to create collection', 'error');
  }
}

function filterByCollection(collectionId) {
  currentFilter.collectionId = collectionId;
  loadVault();
}

// ============ TAGS ============

async function loadTags() {
  if (apiReady && window.SecurePassAPI) {
    try {
      tagsCache = await window.SecurePassAPI.getTags();
      renderTagsFilter();
    } catch (e) {
      console.error('Failed to load tags:', e);
    }
  }
}

function renderTagsFilter() {
  const container = document.getElementById('tagsFilter');
  if (!container) return;

  if (tagsCache.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = tagsCache.map(tag => `
    <button class="tag-btn ${currentFilter.tagIds?.includes(tag.id) ? 'active' : ''}" 
            onclick="toggleTagFilter('${tag.id}')"
            style="${tag.color ? 'background:' + tag.color : ''}">
      ${escapeHtml(tag.name)} (${tag.entryCount})
    </button>
  `).join('');
}

function toggleTagFilter(tagId) {
  if (!currentFilter.tagIds) currentFilter.tagIds = [];

  const idx = currentFilter.tagIds.indexOf(tagId);
  if (idx === -1) {
    currentFilter.tagIds.push(tagId);
  } else {
    currentFilter.tagIds.splice(idx, 1);
  }

  renderTagsFilter();
  loadVault();
}

// ============ VAULT ============

function setupVaultSearch() {
  const searchInput = document.getElementById('vaultSearch');
  if (searchInput) {
    let timeout;
    searchInput.addEventListener('input', function (e) {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        currentFilter.query = e.target.value;
        loadVault();
      }, 300);
    });
  }
}

function setupVaultFilters() {
  const collectionFilter = document.getElementById('collectionFilter');
  if (collectionFilter) {
    collectionFilter.addEventListener('change', function (e) {
      currentFilter.collectionId = e.target.value || undefined;
      loadVault();
    });
  }

  const favoriteFilter = document.getElementById('favoriteFilter');
  if (favoriteFilter) {
    favoriteFilter.addEventListener('change', function (e) {
      currentFilter.isFavorite = e.target.checked ? true : undefined;
      loadVault();
    });
  }
}

async function loadVault() {
  const vault = await fetchVault();
  vaultCache = vault;
  renderVaultList(vault);
}

function renderVaultList(entries) {
  const container = document.getElementById('vaultList');
  if (!container) return;

  if (entries.length === 0) {
    container.innerHTML = currentFilter.query
      ? '<p class="empty-state">No passwords match your search.</p>'
      : '<p class="empty-state">Your vault is empty. Save your first password!</p>';
    return;
  }

  container.innerHTML = entries.map(item => `
    <div class="vault-item ${selectedEntries.has(item.id) ? 'selected' : ''}" data-id="${item.id}">
      <div class="vault-item-select">
        <input type="checkbox" ${selectedEntries.has(item.id) ? 'checked' : ''} 
               onchange="toggleSelectEntry('${item.id}')">
      </div>
      <div class="vault-item-info">
        <h4>
          ${item.isPinned ? '📌 ' : ''}
          ${item.isFavorite ? '⭐ ' : ''}
          ${escapeHtml(item.title)}
          ${renderStrengthBadge(item.strength)}
        </h4>
        <p>${escapeHtml(item.username || '')} ${item.site ? '• ' + escapeHtml(item.site) : ''}</p>
        <div class="vault-item-tags">
          ${(item.tags || []).map(t => `<span class="tag-badge" style="${t.color ? 'background:' + t.color : ''}">${escapeHtml(t.name)}</span>`).join('')}
        </div>
        <div class="vault-item-password" id="pwd-${item.id}">••••••••••••</div>
      </div>
      <div class="vault-item-actions">
        <button onclick="toggleFavorite('${item.id}')" title="${item.isFavorite ? 'Unfavorite' : 'Favorite'}">${item.isFavorite ? '⭐' : '☆'}</button>
        <button onclick="togglePinned('${item.id}')" title="${item.isPinned ? 'Unpin' : 'Pin'}">${item.isPinned ? '📌' : '📍'}</button>
        <button onclick="copyPassword('${item.id}')" title="Copy">📋</button>
        <button onclick="toggleVaultPassword('${item.id}')" title="Show/Hide">👁️</button>
        <button onclick="sharePassword('${item.id}')" title="Share">🔗</button>
        <button onclick="editPassword('${item.id}')" title="Edit">✏️</button>
        <button onclick="deletePassword('${item.id}')" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
}

function renderStrengthBadge(strength) {
  if (strength === null || strength === undefined) return '';
  const badges = ['🔴', '🟠', '🟡', '🟢', '💪'];
  return `<span class="strength-badge" title="Strength: ${strength}/4">${badges[strength] || badges[0]}</span>`;
}

async function fetchVault() {
  if (apiReady && window.SecurePassAPI) {
    try {
      const entries = await window.SecurePassAPI.getPasswords(currentFilter);
      return entries || [];
    } catch (e) {
      console.error('Failed to fetch vault:', e);
      return getLocalVault();
    }
  }
  return getLocalVault();
}

function getLocalVault() {
  try {
    const data = localStorage.getItem(VAULT_KEY);
    const vault = data ? JSON.parse(data) : [];
    return vault.filter(v => v.userId === currentUser.userId);
  } catch (e) {
    return [];
  }
}

function saveLocalVault(vault) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

// ============ PASSWORD ACTIONS ============

async function toggleVaultPassword(id) {
  const el = document.getElementById('pwd-' + id);
  if (!el) return;

  if (el.textContent !== '••••••••••••') {
    el.textContent = '••••••••••••';
    return;
  }

  try {
    let password = '';
    if (apiReady && window.SecurePassAPI) {
      const entry = await window.SecurePassAPI.getPassword(id);
      password = entry.password;
    } else {
      const vault = getLocalVault();
      const item = vault.find(v => v.id === id);
      password = item ? item.password : '';
    }

    el.textContent = password;

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (el.textContent !== '••••••••••••') {
        el.textContent = '••••••••••••';
      }
    }, 10000);
  } catch (e) {
    showToast('Failed to reveal password: ' + e.message, 'error');
  }
}

async function copyPassword(id) {
  try {
    let password = '';
    if (apiReady && window.SecurePassAPI) {
      const entry = await window.SecurePassAPI.getPassword(id);
      password = entry.password;
    } else {
      const vault = getLocalVault();
      const item = vault.find(v => v.id === id);
      password = item ? item.password : '';
    }

    if (!password) {
      showToast('No password to copy', 'error');
      return;
    }

    await navigator.clipboard.writeText(password);
    showToast('Password copied! (Clears in 15s)', 'success');

    setTimeout(() => {
      navigator.clipboard.writeText('').catch(() => { });
    }, 15000);
  } catch (e) {
    showToast('Failed to copy: ' + e.message, 'error');
  }
}

function viewPassword(id) {
  switchTab('vault');
  setTimeout(() => toggleVaultPassword(id), 100);
}

async function toggleFavorite(id) {
  if (apiReady && window.SecurePassAPI) {
    try {
      await window.SecurePassAPI.toggleFavorite(id);
      await loadVault();
      await loadOverviewStats();
    } catch (e) {
      showToast('Failed: ' + e.message, 'error');
    }
  }
}

async function togglePinned(id) {
  if (apiReady && window.SecurePassAPI) {
    try {
      await window.SecurePassAPI.togglePinned(id);
      await loadVault();
    } catch (e) {
      showToast('Failed: ' + e.message, 'error');
    }
  }
}

async function editPassword(id) {
  try {
    let item;
    if (apiReady && window.SecurePassAPI) {
      item = await window.SecurePassAPI.getPassword(id);
    } else {
      const vault = getLocalVault();
      item = vault.find(v => v.id === id);
    }

    if (!item) {
      showToast('Password not found', 'error');
      return;
    }

    document.getElementById('saveTitle').value = item.title || '';
    document.getElementById('saveUsername').value = item.username || '';
    document.getElementById('saveSite').value = item.site || '';
    document.getElementById('savePassword').value = item.password || '';
    document.getElementById('saveNotes').value = item.notes || '';
    document.getElementById('savePasswordForm').dataset.editId = id;

    openSaveModal();
  } catch (e) {
    showToast('Failed to load password: ' + e.message, 'error');
  }
}

async function deletePassword(id) {
  if (!confirm('Delete this password?')) return;

  try {
    if (apiReady && window.SecurePassAPI) {
      await window.SecurePassAPI.deletePassword(id);
    } else {
      let vault = getLocalVault();
      vault = vault.filter(v => v.id !== id);
      saveLocalVault(vault);
    }

    showToast('Password deleted', 'success');
    await loadVault();
    await loadOverviewStats();
    await loadRecentPasswords();
  } catch (e) {
    showToast('Delete failed: ' + e.message, 'error');
  }
}

async function sharePassword(id) {
  if (!apiReady) {
    showToast('Sharing requires backend connection', 'error');
    return;
  }

  const hours = prompt('Expire in hours (default 24):', '24');
  const maxViews = prompt('Max views (default 1):', '1');

  try {
    const result = await window.SecurePassAPI.createShareLink({
      entryId: id,
      expiresInHours: parseInt(hours) || 24,
      maxViews: parseInt(maxViews) || 1,
      includePassword: true
    });

    await navigator.clipboard.writeText(result.shareUrl);
    showToast('Share link copied! Valid for ' + hours + 'h', 'success');
  } catch (e) {
    showToast('Failed to create share link: ' + e.message, 'error');
  }
}

// ============ BULK ACTIONS ============

function setupBulkActions() {
  const selectAllBtn = document.getElementById('selectAllBtn');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', toggleSelectAll);
  }
}

function toggleSelectEntry(id) {
  if (selectedEntries.has(id)) {
    selectedEntries.delete(id);
  } else {
    selectedEntries.add(id);
  }
  updateBulkActionsUI();
}

function toggleSelectAll() {
  if (selectedEntries.size === vaultCache.length) {
    selectedEntries.clear();
  } else {
    vaultCache.forEach(e => selectedEntries.add(e.id));
  }
  renderVaultList(vaultCache);
  updateBulkActionsUI();
}

function updateBulkActionsUI() {
  const bulkActions = document.getElementById('bulkActions');
  const selectedCount = document.getElementById('selectedCount');

  if (bulkActions) {
    bulkActions.style.display = selectedEntries.size > 0 ? 'flex' : 'none';
  }
  if (selectedCount) {
    selectedCount.textContent = selectedEntries.size;
  }
}

async function bulkDelete() {
  if (!confirm(`Delete ${selectedEntries.size} passwords?`)) return;

  try {
    if (apiReady && window.SecurePassAPI) {
      await window.SecurePassAPI.bulkDeletePasswords(Array.from(selectedEntries));
    }
    selectedEntries.clear();
    await loadVault();
    await loadOverviewStats();
    showToast('Deleted successfully', 'success');
  } catch (e) {
    showToast('Bulk delete failed', 'error');
  }
}

async function bulkMove() {
  const collectionId = prompt('Enter collection ID (or leave empty for uncategorized):');

  try {
    if (apiReady && window.SecurePassAPI) {
      await window.SecurePassAPI.moveToCollection(Array.from(selectedEntries), collectionId || null);
    }
    selectedEntries.clear();
    await loadVault();
    showToast('Moved successfully', 'success');
  } catch (e) {
    showToast('Move failed', 'error');
  }
}

// ============ PASSWORD GENERATOR ============

function setupGenerator() {
  const lengthSlider = document.getElementById('genLength');
  const lengthValue = document.getElementById('lengthValue');

  if (lengthSlider && lengthValue) {
    lengthSlider.addEventListener('input', function () {
      lengthValue.textContent = this.value;
    });
  }
}

function generateDashboardPassword() {
  const length = parseInt(document.getElementById('genLength')?.value || '16');
  const useUpper = document.getElementById('genUpper')?.checked !== false;
  const useLower = document.getElementById('genLower')?.checked !== false;
  const useNumbers = document.getElementById('genNumbers')?.checked !== false;
  const useSymbols = document.getElementById('genSymbols')?.checked !== false;

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

  updateStrengthMeter(password);
  showToast('Password generated!', 'success');
}

function updateStrengthMeter(password) {
  const bar = document.getElementById('genStrengthBar');
  const text = document.getElementById('genStrengthText');

  if (!bar || !text) return;

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const normalized = Math.min(score, 5);
  const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const idx = Math.min(normalized, 4);

  bar.style.width = ((normalized + 1) * 20) + '%';
  bar.style.backgroundColor = colors[idx];
  text.textContent = 'Strength: ' + labels[idx];
  text.style.color = colors[idx];
}

function copyGeneratedPassword() {
  const password = document.getElementById('generatedPassword')?.value;
  if (!password) {
    showToast('Generate a password first', 'error');
    return;
  }

  navigator.clipboard.writeText(password);
  showToast('Password copied! (Clears in 15s)', 'success');

  setTimeout(() => {
    navigator.clipboard.writeText('').catch(() => { });
  }, 15000);
}

function toggleGeneratedVisibility() {
  const input = document.getElementById('generatedPassword');
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
}

// ============ QUICK SAVE ============

async function handleQuickSave() {
  if (!currentPassword) {
    showToast('Generate a password first!', 'error');
    return;
  }

  if (!currentUser) {
    document.getElementById('loginRequiredModal')?.showModal();
    return;
  }

  const title = 'Generated ' + new Date().toLocaleTimeString();

  try {
    if (apiReady && window.SecurePassAPI) {
      await window.SecurePassAPI.directSave({
        title: title,
        username: currentUser.email || '',
        password: currentPassword,
        strength: calculateStrength(currentPassword),
        tags: ['generated', 'quick-save', getStrengthLabel(calculateStrength(currentPassword))]
      });
      showToast('Saved to vault!', 'success');
    } else {
      let vault = getLocalVault();
      vault.push({
        id: 'pwd_' + Math.random().toString(36).substr(2, 9),
        userId: currentUser.userId,
        title: title,
        username: currentUser.email || '',
        password: currentPassword,
        createdAt: new Date().toISOString()
      });
      saveLocalVault(vault);
      showToast('Saved locally!', 'success');
    }

    await loadVault();
    await loadOverviewStats();
    await loadRecentPasswords();
  } catch (e) {
    console.error('Quick save failed:', e);
    showToast('Save failed: ' + e.message, 'error');
  }
}

// ============ SAVE MODAL ============

function setupSaveModal() {
  const form = document.getElementById('savePasswordForm');
  if (form) {
    form.addEventListener('submit', handleSavePassword);
  }
}

function openSaveModal() {
  const modal = document.getElementById('saveModal');
  if (!modal) return;

  const passwordInput = document.getElementById('savePassword');
  if (passwordInput && currentPassword && !passwordInput.value) {
    passwordInput.value = currentPassword;
  }

  if (!currentUser) {
    document.getElementById('loginRequiredModal')?.showModal();
    return;
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
}

async function handleSavePassword(e) {
  e.preventDefault();

  const form = e.target;
  const editId = form.dataset.editId;

  const title = document.getElementById('saveTitle').value.trim();
  const username = document.getElementById('saveUsername').value.trim();
  const site = document.getElementById('saveSite').value.trim();
  const password = document.getElementById('savePassword').value;
  const notes = document.getElementById('saveNotes').value.trim();
  const strength = document.getElementById('saveStrength')?.value || null;

  if (!title || !password) {
    showToast('Title and password are required', 'error');
    return;
  }

  try {
    if (apiReady && window.SecurePassAPI) {
      if (editId) {
        await window.SecurePassAPI.updatePassword(editId, { title, username, site, password, notes, strength: strength ? parseInt(strength) : undefined });
        showToast('Password updated!', 'success');
      } else {
        await window.SecurePassAPI.createPassword({ title, username, site, password, notes, strength: strength ? parseInt(strength) : undefined });
        showToast('Password saved!', 'success');
      }
    } else {
      let vault = getLocalVault();
      if (editId) {
        const idx = vault.findIndex(v => v.id === editId);
        if (idx !== -1) {
          vault[idx] = { ...vault[idx], title, username, site, password, notes, updatedAt: new Date().toISOString() };
        }
      } else {
        vault.push({
          id: 'pwd_' + Math.random().toString(36).substr(2, 9),
          userId: currentUser.userId,
          title, username, site, password, notes,
          createdAt: new Date().toISOString()
        });
      }
      saveLocalVault(vault);
      showToast('Password saved locally!', 'success');
    }

    closeSaveModal();
    await loadVault();
    await loadOverviewStats();
    await loadRecentPasswords();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  }
}

// ============ EXPORT / IMPORT ============

async function exportVault() {
  try {
    let entries;
    if (apiReady && window.SecurePassAPI) {
      entries = await window.SecurePassAPI.exportVault();
    } else {
      entries = getLocalVault();
    }

    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'securepass_vault_export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Vault exported!', 'success');
  } catch (e) {
    showToast('Export failed: ' + e.message, 'error');
  }
}

function triggerImport() {
  document.getElementById('importFile')?.click();
}

async function handleImport(input) {
  const file = input?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const data = JSON.parse(e.target.result);
      const entries = Array.isArray(data) ? data : (data.entries || []);

      if (entries.length === 0) {
        showToast('No entries found', 'error');
        return;
      }

      if (apiReady && window.SecurePassAPI) {
        await window.SecurePassAPI.importVault(entries);
      } else {
        let vault = getLocalVault();
        entries.forEach(entry => {
          vault.push({
            ...entry,
            id: 'pwd_' + Math.random().toString(36).substr(2, 9),
            userId: currentUser.userId,
            createdAt: entry.createdAt || new Date().toISOString()
          });
        });
        saveLocalVault(vault);
      }

      showToast('Imported ' + entries.length + ' entries', 'success');
      await loadVault();
      await loadOverviewStats();
    } catch (err) {
      showToast('Import failed: Invalid JSON', 'error');
    }
    input.value = '';
  };
  reader.readAsText(file);
}

// ============ SETTINGS ============

function updateProfile() {
  const name = document.getElementById('settingsName')?.value?.trim();
  if (!name) {
    showToast('Name is required', 'error');
    return;
  }

  currentUser.name = name;
  localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
  setupUserInfo();
  showToast('Profile updated!', 'success');
}

function changePassword() {
  showToast('Password change requires backend implementation', 'info');
}

function deleteAccount() {
  if (!confirm('Delete your account? This cannot be undone.')) return;
  if (!confirm('Are you absolutely sure?')) return;

  clearSession();
  localStorage.removeItem(VAULT_KEY);
  window.location.href = 'index.html';
}

// ============ UTILITIES ============

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

function showToast(message, type) {
  type = type || 'info';
  const container = document.getElementById('toastContainer');
  if (!container) {
    console.log('Toast [' + type + ']: ' + message);
    alert(message);
    return;
  }

  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = '<span>' + message + '</span><button onclick="this.parentElement.remove()">✕</button>';
  container.appendChild(toast);

  setTimeout(function () { toast.remove(); }, 4000);
}

// ============ MAKE FUNCTIONS GLOBAL ============

window.switchTab = switchTab;
window.generateDashboardPassword = generateDashboardPassword;
window.copyGeneratedPassword = copyGeneratedPassword;
window.toggleGeneratedVisibility = toggleGeneratedVisibility;
window.handleQuickSave = handleQuickSave;
window.openSaveModal = openSaveModal;
window.closeSaveModal = closeSaveModal;
window.copyPassword = copyPassword;
window.viewPassword = viewPassword;
window.toggleVaultPassword = toggleVaultPassword;
window.toggleFavorite = toggleFavorite;
window.togglePinned = togglePinned;
window.editPassword = editPassword;
window.deletePassword = deletePassword;
window.sharePassword = sharePassword;
window.exportVault = exportVault;
window.triggerImport = triggerImport;
window.handleImport = handleImport;
window.updateProfile = updateProfile;
window.changePassword = changePassword;
window.deleteAccount = deleteAccount;
window.createNewCollection = createNewCollection;
window.filterByCollection = filterByCollection;
window.toggleTagFilter = toggleTagFilter;
window.toggleSelectEntry = toggleSelectEntry;
window.toggleSelectAll = toggleSelectAll;
window.bulkDelete = bulkDelete;
window.bulkMove = bulkMove;

// Helper to reuse strength calculation
function calculateStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return Math.min(score, 5);
}

function getStrengthLabel(score) {
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Strong'];
  return labels[Math.min(score, 5)] || 'Weak';
}

console.log('Dashboard.js loaded with all features');
