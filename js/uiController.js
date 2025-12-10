/**
 * uiController.js - DOM Updates and Event Binding
 * 
 * This module handles all UI interactions including:
 * - DOM element references
 * - Event listener binding
 * - UI state updates
 * - Toast notifications
 * - Modal management
 */

import { evaluatePassword } from './strengthMeter.js';
import { 
  getCurrentPageEntries, 
  getTotalPages, 
  getCurrentPage, 
  hasEntries,
  formatDate,
  maskPassword
} from './history.js';
import { announce, setAriaPressed } from './accessibility.js';

// DOM Element References
const elements = {};

// State
let passwordVisible = true;
let currentPassword = '';
let toastTimeouts = new Map();

/**
 * Initialize UI controller and cache DOM elements
 */
export function initUI() {
  cacheElements();
}

/**
 * Cache all DOM element references
 */
function cacheElements() {
  // Header
  elements.themeToggle = document.getElementById('themeToggle');
  elements.helpBtn = document.getElementById('helpBtn');
  
  // Policy form
  elements.policyForm = document.getElementById('policyForm');
  elements.lengthInput = document.getElementById('length');
  elements.minUpperInput = document.getElementById('minUpper');
  elements.minLowerInput = document.getElementById('minLower');
  elements.minDigitsInput = document.getElementById('minDigits');
  elements.minSymbolsInput = document.getElementById('minSymbols');
  elements.avoidSimilarCheckbox = document.getElementById('avoidSimilar');
  elements.noRepeatingCheckbox = document.getElementById('noRepeating');
  elements.policyError = document.getElementById('policyError');
  
  // Buttons
  elements.generateBtn = document.getElementById('generateBtn');
  elements.copyBtn = document.getElementById('copyBtn');
  elements.loadExampleBtn = document.getElementById('loadExampleBtn');
  
  // AI section
  elements.aiPrompt = document.getElementById('aiPrompt');
  elements.aiGenerateBtn = document.getElementById('aiGenerateBtn');
  elements.aiError = document.getElementById('aiError');
  
  // Result section
  elements.passwordOutput = document.getElementById('passwordOutput');
  elements.toggleVisibility = document.getElementById('toggleVisibility');
  elements.entropyDisplay = document.getElementById('entropyDisplay');
  elements.strengthLabel = document.getElementById('strengthLabel');
  elements.strengthSegments = [
    document.getElementById('strengthSegment1'),
    document.getElementById('strengthSegment2'),
    document.getElementById('strengthSegment3'),
    document.getElementById('strengthSegment4'),
    document.getElementById('strengthSegment5')
  ];
  
  // History section
  elements.historySearch = document.getElementById('historySearch');
  elements.historySort = document.getElementById('historySort');
  elements.historyList = document.getElementById('historyList');
  elements.clearHistoryBtn = document.getElementById('clearHistoryBtn');
  elements.pagination = document.getElementById('pagination');
  elements.prevPage = document.getElementById('prevPage');
  elements.nextPage = document.getElementById('nextPage');
  elements.pageInfo = document.getElementById('pageInfo');
  
  // Toast container
  elements.toastContainer = document.getElementById('toastContainer');
  
  // Help modal
  elements.helpModal = document.getElementById('helpModal');
}

/**
 * Get cached element
 * 
 * @param {string} name - Element name
 * @returns {HTMLElement}
 */
export function getElement(name) {
  return elements[name];
}

/**
 * Get current policy values from form
 * 
 * @returns {Object} Policy options
 */
export function getPolicyFromForm() {
  return {
    length: parseInt(elements.lengthInput?.value, 10) || 16,
    minUppercase: parseInt(elements.minUpperInput?.value, 10) || 0,
    minLowercase: parseInt(elements.minLowerInput?.value, 10) || 0,
    minDigits: parseInt(elements.minDigitsInput?.value, 10) || 0,
    minSymbols: parseInt(elements.minSymbolsInput?.value, 10) || 0,
    avoidSimilar: elements.avoidSimilarCheckbox?.checked ?? true,
    noRepeating: elements.noRepeatingCheckbox?.checked ?? false
  };
}

/**
 * Set policy values in form
 * 
 * @param {Object} policy - Policy options
 */
export function setPolicyInForm(policy) {
  if (elements.lengthInput) elements.lengthInput.value = policy.length ?? 16;
  if (elements.minUpperInput) elements.minUpperInput.value = policy.minUppercase ?? 1;
  if (elements.minLowerInput) elements.minLowerInput.value = policy.minLowercase ?? 1;
  if (elements.minDigitsInput) elements.minDigitsInput.value = policy.minDigits ?? 1;
  if (elements.minSymbolsInput) elements.minSymbolsInput.value = policy.minSymbols ?? 1;
  if (elements.avoidSimilarCheckbox) elements.avoidSimilarCheckbox.checked = policy.avoidSimilar ?? true;
  if (elements.noRepeatingCheckbox) elements.noRepeatingCheckbox.checked = policy.noRepeating ?? false;
}

/**
 * Show policy error message
 * 
 * @param {string} message - Error message
 */
export function showPolicyError(message) {
  if (elements.policyError) {
    elements.policyError.textContent = message;
  }
  announce(message, 'assertive');
}

/**
 * Clear policy error message
 */
export function clearPolicyError() {
  if (elements.policyError) {
    elements.policyError.textContent = '';
  }
}

/**
 * Show AI error message
 * 
 * @param {string} message - Error message
 */
export function showAIError(message) {
  if (elements.aiError) {
    elements.aiError.textContent = message;
  }
  announce(message, 'assertive');
}

/**
 * Clear AI error message
 */
export function clearAIError() {
  if (elements.aiError) {
    elements.aiError.textContent = '';
  }
}

/**
 * Update password display
 * 
 * @param {string} password - Generated password
 */
export function updatePasswordDisplay(password) {
  currentPassword = password;
  
  if (elements.passwordOutput) {
    if (passwordVisible) {
      elements.passwordOutput.textContent = password;
      elements.passwordOutput.classList.remove('masked');
    } else {
      elements.passwordOutput.textContent = maskPassword(password);
      elements.passwordOutput.classList.add('masked');
    }
  }
  
  // Enable copy button
  if (elements.copyBtn) {
    elements.copyBtn.disabled = !password || password === '—';
  }
  
  // Update strength meter
  updateStrengthMeter(password);
  
  // Announce to screen readers
  announce(`Password generated. ${password.length} characters.`);
}

/**
 * Update strength meter display
 * 
 * @param {string} password - Password to evaluate
 */
export function updateStrengthMeter(password) {
  const evaluation = evaluatePassword(password);
  
  // Update entropy display
  if (elements.entropyDisplay) {
    elements.entropyDisplay.textContent = `Entropy: ${evaluation.entropy} bits`;
  }
  
  // Update strength label
  if (elements.strengthLabel) {
    elements.strengthLabel.textContent = `Strength: ${evaluation.label}`;
  }
  
  // Update strength bar segments
  elements.strengthSegments.forEach((segment, index) => {
    // Remove all active classes
    segment.className = 'strength-segment';
    
    // Add active class if this segment should be lit
    if (index <= evaluation.score) {
      segment.classList.add(`active-${evaluation.score + 1}`);
    }
  });
}

/**
 * Toggle password visibility
 */
export function togglePasswordVisibility() {
  passwordVisible = !passwordVisible;
  
  // Update display
  if (elements.passwordOutput && currentPassword) {
    if (passwordVisible) {
      elements.passwordOutput.textContent = currentPassword;
      elements.passwordOutput.classList.remove('masked');
    } else {
      elements.passwordOutput.textContent = maskPassword(currentPassword);
      elements.passwordOutput.classList.add('masked');
    }
  }
  
  // Update button icons
  if (elements.toggleVisibility) {
    const eyeIcon = elements.toggleVisibility.querySelector('.eye-icon');
    const eyeOffIcon = elements.toggleVisibility.querySelector('.eye-off-icon');
    
    if (passwordVisible) {
      eyeIcon?.classList.remove('hidden');
      eyeOffIcon?.classList.add('hidden');
    } else {
      eyeIcon?.classList.add('hidden');
      eyeOffIcon?.classList.remove('hidden');
    }
    
    setAriaPressed(elements.toggleVisibility, passwordVisible);
  }
  
  announce(passwordVisible ? 'Password visible' : 'Password hidden');
}

/**
 * Show copy success state on button
 */
export function showCopySuccess() {
  if (!elements.copyBtn) return;
  
  elements.copyBtn.classList.add('copied');
  const btnText = elements.copyBtn.querySelector('.btn-text');
  if (btnText) btnText.textContent = 'Copied!';
  
  // Reset after delay
  setTimeout(() => {
    elements.copyBtn.classList.remove('copied');
    if (btnText) btnText.textContent = 'Copy';
  }, 2000);
  
  announce('Password copied to clipboard');
}

/**
 * Set AI button loading state
 * 
 * @param {boolean} loading - Loading state
 */
export function setAILoading(loading) {
  if (!elements.aiGenerateBtn) return;
  
  if (loading) {
    elements.aiGenerateBtn.classList.add('loading');
    elements.aiGenerateBtn.disabled = true;
    const btnText = elements.aiGenerateBtn.querySelector('.btn-text');
    if (btnText) btnText.textContent = 'Generating...';
  } else {
    elements.aiGenerateBtn.classList.remove('loading');
    elements.aiGenerateBtn.disabled = false;
    const btnText = elements.aiGenerateBtn.querySelector('.btn-text');
    if (btnText) btnText.textContent = 'Generate with AI';
  }
}

/**
 * Get AI prompt text
 * 
 * @returns {string}
 */
export function getAIPrompt() {
  return elements.aiPrompt?.value?.trim() || '';
}

/**
 * Render history list
 */
export function renderHistoryList() {
  if (!elements.historyList) return;
  
  const entries = getCurrentPageEntries();
  const totalPages = getTotalPages();
  const currentPage = getCurrentPage();
  const hasAnyEntries = hasEntries();
  
  // Clear existing content
  elements.historyList.innerHTML = '';
  
  // Show empty state if no entries at all
  if (!hasAnyEntries) {
    elements.historyList.innerHTML = `
      <div class="history-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
        <p>No passwords generated yet</p>
      </div>
    `;
    elements.pagination?.classList.add('hidden');
    return;
  }
  
  // Show "no results" if search returned nothing
  if (entries.length === 0) {
    elements.historyList.innerHTML = `
      <div class="history-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>No matching passwords found</p>
      </div>
    `;
    elements.pagination?.classList.add('hidden');
    return;
  }
  
  // Render entries
  entries.forEach(entry => {
    const item = createHistoryItem(entry);
    elements.historyList.appendChild(item);
  });
  
  // Update pagination
  updatePagination(currentPage, totalPages);
}

/**
 * Escape HTML special characters to prevent XSS
 * 
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Create a history item element
 * 
 * @param {Object} entry - History entry
 * @returns {HTMLElement}
 */
function createHistoryItem(entry) {
  const item = document.createElement('div');
  item.className = 'history-item';
  item.setAttribute('role', 'listitem');
  item.dataset.id = entry.id;
  // Store password safely in dataset (automatically escaped)
  item.dataset.password = entry.password || '';
  
  const strengthClass = entry.strengthLabel?.toLowerCase().replace(' ', '-') || 'medium';
  const sourceClass = entry.source === 'ai' ? 'ai-source' : 'manual-source';
  
  item.innerHTML = `
    <div class="history-item-main">
      <div class="history-password">
        ${escapeHtml(maskPassword(entry.password))}
      </div>
      <div class="history-meta">
        <span class="badge badge-strength badge-${escapeHtml(strengthClass)}">${escapeHtml(entry.strengthLabel) || 'Unknown'}</span>
        <span>${entry.length || 0} chars</span>
        <span class="badge badge-${sourceClass}">${entry.source === 'ai' ? 'AI' : 'Manual'}</span>
        <span>${escapeHtml(formatDate(entry.createdAt))}</span>
      </div>
    </div>
    <div class="history-actions">
      <button type="button" class="icon-btn btn-sm history-toggle-visibility" aria-label="Toggle password visibility" title="Show/hide password">
        <svg class="eye-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <svg class="eye-off-icon hidden" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      </button>
      <button type="button" class="icon-btn btn-sm history-copy" aria-label="Copy password" title="Copy to clipboard">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </button>
      <button type="button" class="icon-btn btn-sm history-delete" aria-label="Delete password" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `;
  
  return item;
}

/**
 * Update pagination controls
 * 
 * @param {number} currentPage - Current page number
 * @param {number} totalPages - Total pages
 */
function updatePagination(currentPage, totalPages) {
  if (!elements.pagination) return;
  
  if (totalPages <= 1) {
    elements.pagination.classList.add('hidden');
    return;
  }
  
  elements.pagination.classList.remove('hidden');
  
  if (elements.prevPage) {
    elements.prevPage.disabled = currentPage <= 1;
  }
  
  if (elements.nextPage) {
    elements.nextPage.disabled = currentPage >= totalPages;
  }
  
  if (elements.pageInfo) {
    elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  }
}

/**
 * Show a toast notification
 * 
 * @param {Object} options - Toast options
 * @param {string} options.type - 'success', 'error', 'warning', 'info'
 * @param {string} options.message - Toast message
 * @param {Object} options.action - Optional action { label, callback }
 * @param {number} options.duration - Duration in ms (default 5000)
 */
export function showToast(options) {
  const { type = 'info', message, action, duration = 5000 } = options;
  
  if (!elements.toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icons = {
    success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
  };
  
  toast.innerHTML = `
    <svg class="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${icons[type] || icons.info}
    </svg>
    <span class="toast-message">${message}</span>
    ${action ? `<button type="button" class="toast-action">${action.label}</button>` : ''}
    <button type="button" class="toast-close" aria-label="Close notification">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;
  
  // Add event listeners
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn?.addEventListener('click', () => dismissToast(toast));
  
  if (action) {
    const actionBtn = toast.querySelector('.toast-action');
    actionBtn?.addEventListener('click', () => {
      action.callback();
      dismissToast(toast);
    });
  }
  
  elements.toastContainer.appendChild(toast);
  
  // Auto dismiss
  const timeoutId = setTimeout(() => dismissToast(toast), duration);
  toastTimeouts.set(toast, timeoutId);
  
  // Announce to screen readers
  announce(message);
}

/**
 * Dismiss a toast notification
 * 
 * @param {HTMLElement} toast - Toast element
 */
function dismissToast(toast) {
  // Clear timeout
  const timeoutId = toastTimeouts.get(toast);
  if (timeoutId) {
    clearTimeout(timeoutId);
    toastTimeouts.delete(toast);
  }
  
  // Animate out
  toast.classList.add('toast-out');
  
  // Remove after animation
  setTimeout(() => {
    toast.remove();
  }, 200);
}

/**
 * Open help modal
 */
export function openHelpModal() {
  if (elements.helpModal) {
    elements.helpModal.showModal();
  }
}

/**
 * Close help modal
 */
export function closeHelpModal() {
  if (elements.helpModal) {
    elements.helpModal.close();
  }
}

/**
 * Set up help modal close handlers
 */
export function setupHelpModal() {
  if (!elements.helpModal) return;
  
  // Close button
  const closeBtn = elements.helpModal.querySelector('.modal-close');
  closeBtn?.addEventListener('click', closeHelpModal);
  
  // Click outside to close
  elements.helpModal.addEventListener('click', (event) => {
    if (event.target === elements.helpModal) {
      closeHelpModal();
    }
  });
}

/**
 * Apply theme to document
 * 
 * @param {string} theme - 'dark' or 'light'
 */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  
  // Update theme button emoji
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
  }
}

/**
 * Get current password
 * 
 * @returns {string}
 */
export function getCurrentPassword() {
  return currentPassword;
}

/**
 * Initialize button ripple effects
 */
export function initRippleEffects() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    
    btn.appendChild(ripple);
    
    ripple.addEventListener('animationend', () => ripple.remove());
  });
}
