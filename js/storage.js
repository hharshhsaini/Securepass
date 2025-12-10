/**
 * storage.js - Client-Side Storage Management
 * 
 * This module handles all persistent storage operations using IndexedDB
 * with localStorage fallback. It manages:
 * - Password history
 * - Policy configuration
 * - Theme preferences
 * - Undo functionality
 */

const DB_NAME = 'CredentialGeneratorDB';
const DB_VERSION = 1;
const STORE_HISTORY = 'passwordHistory';
const STORE_CONFIG = 'config';

// LocalStorage keys (fallback)
const LS_HISTORY = 'cg_history';
const LS_POLICY = 'cg_policy';
const LS_THEME = 'cg_theme';

// Undo stack (in-memory)
let undoStack = [];
const MAX_UNDO_ITEMS = 100;

// Database instance
let db = null;

/**
 * Initialize IndexedDB connection
 * 
 * @returns {Promise<IDBDatabase>} Database instance
 */
function initDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }
    
    // Check if IndexedDB is available
    if (!window.indexedDB) {
      console.warn('IndexedDB not available, using localStorage fallback');
      reject(new Error('IndexedDB not available'));
      return;
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Create password history store
      if (!database.objectStoreNames.contains(STORE_HISTORY)) {
        const historyStore = database.createObjectStore(STORE_HISTORY, { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        historyStore.createIndex('createdAt', 'createdAt', { unique: false });
        historyStore.createIndex('strength', 'strength', { unique: false });
        historyStore.createIndex('length', 'length', { unique: false });
      }
      
      // Create config store
      if (!database.objectStoreNames.contains(STORE_CONFIG)) {
        database.createObjectStore(STORE_CONFIG, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Check if IndexedDB is available and working
 * 
 * @returns {Promise<boolean>}
 */
async function isIndexedDBAvailable() {
  try {
    await initDB();
    return true;
  } catch {
    return false;
  }
}

// ============================================
// Password History Operations
// ============================================

/**
 * Save a password entry to history
 * 
 * @param {Object} entry - Password entry
 * @param {string} entry.password - The generated password
 * @param {number} entry.length - Password length
 * @param {number} entry.entropy - Entropy in bits
 * @param {number} entry.strength - Strength score (0-4)
 * @param {string} entry.strengthLabel - Strength label
 * @param {string} entry.source - 'manual' or 'ai'
 * @returns {Promise<number>} Entry ID
 */
export async function savePasswordEntry(entry) {
  const fullEntry = {
    ...entry,
    createdAt: new Date().toISOString()
  };
  
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_HISTORY], 'readwrite');
      const store = transaction.objectStore(STORE_HISTORY);
      const request = store.add(fullEntry);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Fallback to localStorage
    const history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    const id = Date.now();
    history.push({ ...fullEntry, id });
    localStorage.setItem(LS_HISTORY, JSON.stringify(history));
    return id;
  }
}

/**
 * Load all password history entries
 * 
 * @returns {Promise<Array>} Array of history entries
 */
export async function loadPasswordHistory() {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_HISTORY], 'readonly');
      const store = transaction.objectStore(STORE_HISTORY);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Fallback to localStorage
    return JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
  }
}

/**
 * Delete a single history entry
 * 
 * @param {number} id - Entry ID to delete
 * @returns {Promise<void>}
 */
export async function deleteHistoryEntry(id) {
  try {
    const database = await initDB();
    
    // Get the entry first for undo
    const entry = await new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_HISTORY], 'readonly');
      const store = transaction.objectStore(STORE_HISTORY);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    if (entry) {
      // Add to undo stack
      addToUndoStack({ type: 'delete', entries: [entry] });
    }
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_HISTORY], 'readwrite');
      const store = transaction.objectStore(STORE_HISTORY);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Fallback to localStorage
    const history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    const entry = history.find(e => e.id === id);
    if (entry) {
      addToUndoStack({ type: 'delete', entries: [entry] });
    }
    const filtered = history.filter(e => e.id !== id);
    localStorage.setItem(LS_HISTORY, JSON.stringify(filtered));
  }
}

/**
 * Clear all password history
 * 
 * @returns {Promise<void>}
 */
export async function clearHistory() {
  try {
    // Get all entries first for undo
    const entries = await loadPasswordHistory();
    if (entries.length > 0) {
      addToUndoStack({ type: 'clear', entries });
    }
    
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_HISTORY], 'readwrite');
      const store = transaction.objectStore(STORE_HISTORY);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Fallback to localStorage
    const history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    if (history.length > 0) {
      addToUndoStack({ type: 'clear', entries: history });
    }
    localStorage.removeItem(LS_HISTORY);
  }
}

// ============================================
// Policy Configuration Operations
// ============================================

/**
 * Save policy configuration
 * 
 * @param {Object} policy - Policy options
 * @returns {Promise<void>}
 */
export async function savePolicyConfig(policy) {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_CONFIG], 'readwrite');
      const store = transaction.objectStore(STORE_CONFIG);
      const request = store.put({ key: 'policy', value: policy });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    localStorage.setItem(LS_POLICY, JSON.stringify(policy));
  }
}

/**
 * Load policy configuration
 * 
 * @returns {Promise<Object|null>} Policy options or null
 */
export async function loadPolicyConfig() {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_CONFIG], 'readonly');
      const store = transaction.objectStore(STORE_CONFIG);
      const request = store.get('policy');
      
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    const stored = localStorage.getItem(LS_POLICY);
    return stored ? JSON.parse(stored) : null;
  }
}

// ============================================
// Theme Operations
// ============================================

/**
 * Save theme preference
 * 
 * @param {string} theme - 'dark' or 'light'
 * @returns {Promise<void>}
 */
export async function saveTheme(theme) {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_CONFIG], 'readwrite');
      const store = transaction.objectStore(STORE_CONFIG);
      const request = store.put({ key: 'theme', value: theme });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    localStorage.setItem(LS_THEME, theme);
  }
}

/**
 * Load theme preference
 * 
 * @returns {Promise<string>} Theme name ('dark' or 'light')
 */
export async function loadTheme() {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_CONFIG], 'readonly');
      const store = transaction.objectStore(STORE_CONFIG);
      const request = store.get('theme');
      
      request.onsuccess = () => resolve(request.result?.value || 'dark');
      request.onerror = () => reject(request.error);
    });
  } catch {
    return localStorage.getItem(LS_THEME) || 'dark';
  }
}

// ============================================
// Undo Operations
// ============================================

/**
 * Add an action to the undo stack
 * 
 * @param {Object} action - Action to store
 */
function addToUndoStack(action) {
  undoStack.push({
    ...action,
    timestamp: Date.now()
  });
  
  // Limit stack size
  if (undoStack.length > MAX_UNDO_ITEMS) {
    undoStack.shift();
  }
}

/**
 * Check if there's an action that can be undone
 * 
 * @param {number} timeoutMs - Maximum age of undoable action (default 10 seconds)
 * @returns {boolean}
 */
export function canUndo(timeoutMs = 10000) {
  if (undoStack.length === 0) return false;
  const lastAction = undoStack[undoStack.length - 1];
  return Date.now() - lastAction.timestamp < timeoutMs;
}

/**
 * Get the last undoable action type
 * 
 * @returns {string|null} Action type or null
 */
export function getLastUndoType() {
  if (undoStack.length === 0) return null;
  return undoStack[undoStack.length - 1].type;
}

/**
 * Undo the last action
 * 
 * @returns {Promise<boolean>} True if undo was successful
 */
export async function undoLastAction() {
  if (!canUndo()) return false;
  
  const action = undoStack.pop();
  if (!action) return false;
  
  try {
    if (action.type === 'delete' || action.type === 'clear') {
      // Restore deleted entries
      const database = await initDB();
      
      for (const entry of action.entries) {
        await new Promise((resolve, reject) => {
          const transaction = database.transaction([STORE_HISTORY], 'readwrite');
          const store = transaction.objectStore(STORE_HISTORY);
          const request = store.add(entry);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
      
      return true;
    }
  } catch {
    // Fallback to localStorage
    if (action.type === 'delete' || action.type === 'clear') {
      const history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
      history.push(...action.entries);
      localStorage.setItem(LS_HISTORY, JSON.stringify(history));
      return true;
    }
  }
  
  return false;
}

/**
 * Clear the undo stack
 */
export function clearUndoStack() {
  undoStack = [];
}
