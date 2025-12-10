/**
 * history.js - Password History Management
 * 
 * This module handles the password history list including:
 * - Rendering history entries
 * - Search with debouncing
 * - Sorting
 * - Pagination
 */

import { loadPasswordHistory, deleteHistoryEntry, clearHistory, canUndo, undoLastAction } from './storage.js';

// Configuration
const ITEMS_PER_PAGE = 10;
const DEBOUNCE_DELAY = 300;

// State
let allEntries = [];
let filteredEntries = [];
let currentPage = 1;
let currentSort = 'newest';
let searchQuery = '';
let searchTimeout = null;

// Callbacks
let onHistoryChange = null;
let onShowToast = null;

/**
 * Initialize history module with callbacks
 * 
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onHistoryChange - Called when history changes
 * @param {Function} callbacks.onShowToast - Called to show toast notifications
 */
export function initHistory(callbacks) {
  onHistoryChange = callbacks.onHistoryChange;
  onShowToast = callbacks.onShowToast;
}

/**
 * Load and refresh history from storage
 * 
 * @returns {Promise<void>}
 */
export async function refreshHistory() {
  try {
    allEntries = await loadPasswordHistory();
    applyFiltersAndSort();
  } catch (error) {
    console.error('Failed to load history:', error);
    allEntries = [];
    filteredEntries = [];
  }
}

/**
 * Add a new entry to history (in-memory, already saved to storage)
 * 
 * @param {Object} entry - Password entry
 */
export function addEntry(entry) {
  allEntries.push(entry);
  applyFiltersAndSort();
}

/**
 * Apply current search filter and sort to entries
 */
function applyFiltersAndSort() {
  // Filter by search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredEntries = allEntries.filter(entry => {
      // Search in password (if visible), strength label, source
      const passwordMatch = entry.password?.toLowerCase().includes(query);
      const strengthMatch = entry.strengthLabel?.toLowerCase().includes(query);
      const sourceMatch = entry.source?.toLowerCase().includes(query);
      return passwordMatch || strengthMatch || sourceMatch;
    });
  } else {
    filteredEntries = [...allEntries];
  }
  
  // Apply sorting
  sortEntries();
  
  // Reset to first page if current page is out of bounds
  const totalPages = getTotalPages();
  if (currentPage > totalPages) {
    currentPage = Math.max(1, totalPages);
  }
  
  // Notify UI to re-render
  if (onHistoryChange) {
    onHistoryChange();
  }
}

/**
 * Sort filtered entries based on current sort option
 */
function sortEntries() {
  switch (currentSort) {
    case 'newest':
      filteredEntries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      break;
    case 'oldest':
      filteredEntries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      break;
    case 'strongest':
      filteredEntries.sort((a, b) => b.strength - a.strength);
      break;
    case 'weakest':
      filteredEntries.sort((a, b) => a.strength - b.strength);
      break;
    case 'longest':
      filteredEntries.sort((a, b) => b.length - a.length);
      break;
    case 'shortest':
      filteredEntries.sort((a, b) => a.length - b.length);
      break;
    default:
      // Default to newest
      filteredEntries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

/**
 * Set search query with debouncing
 * 
 * @param {string} query - Search query
 */
export function setSearchQuery(query) {
  searchQuery = query;
  
  // Clear existing timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  // Debounce the search
  searchTimeout = setTimeout(() => {
    currentPage = 1; // Reset to first page on new search
    applyFiltersAndSort();
  }, DEBOUNCE_DELAY);
}

/**
 * Set sort option
 * 
 * @param {string} sortOption - Sort option
 */
export function setSortOption(sortOption) {
  currentSort = sortOption;
  applyFiltersAndSort();
}

/**
 * Get current page of entries
 * 
 * @returns {Array} Entries for current page
 */
export function getCurrentPageEntries() {
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  return filteredEntries.slice(startIndex, endIndex);
}

/**
 * Get total number of pages
 * 
 * @returns {number} Total pages
 */
export function getTotalPages() {
  return Math.ceil(filteredEntries.length / ITEMS_PER_PAGE);
}

/**
 * Get current page number
 * 
 * @returns {number} Current page
 */
export function getCurrentPage() {
  return currentPage;
}

/**
 * Get total entry count
 * 
 * @returns {number} Total entries
 */
export function getTotalEntries() {
  return filteredEntries.length;
}

/**
 * Check if there are any entries
 * 
 * @returns {boolean}
 */
export function hasEntries() {
  return allEntries.length > 0;
}

/**
 * Go to next page
 */
export function nextPage() {
  if (currentPage < getTotalPages()) {
    currentPage++;
    if (onHistoryChange) {
      onHistoryChange();
    }
  }
}

/**
 * Go to previous page
 */
export function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    if (onHistoryChange) {
      onHistoryChange();
    }
  }
}

/**
 * Go to specific page
 * 
 * @param {number} page - Page number
 */
export function goToPage(page) {
  const totalPages = getTotalPages();
  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    if (onHistoryChange) {
      onHistoryChange();
    }
  }
}

/**
 * Delete a single entry
 * 
 * @param {number} id - Entry ID
 * @returns {Promise<void>}
 */
export async function deleteEntry(id) {
  try {
    await deleteHistoryEntry(id);
    
    // Remove from local array
    allEntries = allEntries.filter(e => e.id !== id);
    applyFiltersAndSort();
    
    // Show undo toast
    if (onShowToast) {
      onShowToast({
        type: 'info',
        message: 'Password deleted',
        action: {
          label: 'Undo',
          callback: handleUndo
        },
        duration: 10000
      });
    }
  } catch (error) {
    console.error('Failed to delete entry:', error);
    if (onShowToast) {
      onShowToast({
        type: 'error',
        message: 'Failed to delete password'
      });
    }
  }
}

/**
 * Clear all history
 * 
 * @returns {Promise<void>}
 */
export async function clearAllHistory() {
  try {
    await clearHistory();
    allEntries = [];
    filteredEntries = [];
    currentPage = 1;
    
    if (onHistoryChange) {
      onHistoryChange();
    }
    
    // Show undo toast
    if (onShowToast) {
      onShowToast({
        type: 'info',
        message: 'History cleared',
        action: {
          label: 'Undo',
          callback: handleUndo
        },
        duration: 10000
      });
    }
  } catch (error) {
    console.error('Failed to clear history:', error);
    if (onShowToast) {
      onShowToast({
        type: 'error',
        message: 'Failed to clear history'
      });
    }
  }
}

/**
 * Handle undo action
 */
async function handleUndo() {
  if (!canUndo()) {
    if (onShowToast) {
      onShowToast({
        type: 'warning',
        message: 'Undo time expired'
      });
    }
    return;
  }
  
  try {
    const success = await undoLastAction();
    if (success) {
      await refreshHistory();
      if (onShowToast) {
        onShowToast({
          type: 'success',
          message: 'Action undone'
        });
      }
    }
  } catch (error) {
    console.error('Failed to undo:', error);
    if (onShowToast) {
      onShowToast({
        type: 'error',
        message: 'Failed to undo action'
      });
    }
  }
}

/**
 * Format date for display
 * 
 * @param {string} isoString - ISO date string
 * @returns {string} Formatted date
 */
export function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

/**
 * Mask a password for display
 * 
 * @param {string} password - Password to mask
 * @returns {string} Masked password
 */
export function maskPassword(password) {
  if (!password) return '••••••••';
  return '•'.repeat(Math.min(password.length, 16));
}
