/**
 * main.js - Application Entry Point
 * 
 * This module initializes the application and wires together all modules:
 * - Password generation
 * - Strength evaluation
 * - Storage management
 * - History management
 * - UI updates
 * - Accessibility features
 * - Mini game
 * - Scroll animations
 */

import { generatePassword, getExamplePolicy } from './passwordGenerator.js';
import { evaluatePassword } from './strengthMeter.js';
import { 
  savePasswordEntry, 
  savePolicyConfig, 
  loadPolicyConfig, 
  saveTheme, 
  loadTheme 
} from './storage.js';
import { 
  initHistory, 
  refreshHistory, 
  addEntry,
  setSearchQuery, 
  setSortOption, 
  nextPage, 
  prevPage,
  deleteEntry,
  clearAllHistory
} from './history.js';
import { 
  initAccessibility, 
  registerShortcut, 
  announce 
} from './accessibility.js';
import {
  initUI,
  getElement,
  getPolicyFromForm,
  setPolicyInForm,
  showPolicyError,
  clearPolicyError,
  showAIError,
  clearAIError,
  updatePasswordDisplay,
  togglePasswordVisibility,
  showCopySuccess,
  setAILoading,
  getAIPrompt,
  renderHistoryList,
  showToast,
  openHelpModal,
  closeHelpModal,
  setupHelpModal,
  applyTheme,
  getCurrentPassword,
  initRippleEffects
} from './uiController.js';
import { initGame } from './game.js';
import { initScroll } from './scroll.js';

// Gemini API configuration
// Option 1: Set window.GEMINI_API_KEY in HTML before this script loads
// Option 2: If using Vite, set VITE_GEMINI_API_KEY in .env file
// Option 3: Hardcode your key below (not recommended for public repos)
const GEMINI_API_KEY = window.GEMINI_API_KEY 
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY)
  || 'AIzaSyD9xtOoVde1y-kKPUT_Hy4Rn5wfXOm8PEk';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Current theme
let currentTheme = 'dark';

/**
 * Initialize the application
 */
async function init() {
  console.log('Initializing SecurePass Studio...');
  
  try {
    // Initialize UI controller (cache DOM elements)
    initUI();
    
    // Initialize accessibility features
    initAccessibility();
    
    // Initialize scroll animations and smooth scrolling
    initScroll();
    
    // Initialize mini game
    initGame();
    
    // Initialize history module with callbacks
    initHistory({
      onHistoryChange: renderHistoryList,
      onShowToast: showToast
    });
    
    // Load saved theme
    await loadSavedTheme();
    
    // Load saved policy configuration
    await loadSavedPolicy();
    
    // Load password history
    await refreshHistory();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Set up help modal
    setupHelpModal();
    
    // Set up contact modal
    setupContactModal();
    
    // Initial render
    renderHistoryList();
    
    // Initialize button ripple effects
    initRippleEffects();
    
    // Add intro animation class
    document.body.classList.add('loaded');
    
    console.log('SecurePass Studio initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    showToast({
      type: 'error',
      message: 'Failed to initialize application. Please refresh the page.'
    });
  }
}

/**
 * Load saved theme from storage
 */
async function loadSavedTheme() {
  try {
    currentTheme = await loadTheme();
    applyTheme(currentTheme);
  } catch (error) {
    console.warn('Failed to load theme, using default:', error);
    applyTheme('dark');
  }
}

/**
 * Load saved policy configuration from storage
 */
async function loadSavedPolicy() {
  try {
    const savedPolicy = await loadPolicyConfig();
    if (savedPolicy) {
      setPolicyInForm(savedPolicy);
    }
  } catch (error) {
    console.warn('Failed to load policy config:', error);
  }
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Generate button
  const generateBtn = getElement('generateBtn');
  generateBtn?.addEventListener('click', handleGenerate);
  
  // Copy button
  const copyBtn = getElement('copyBtn');
  copyBtn?.addEventListener('click', handleCopy);
  
  // Load example button
  const loadExampleBtn = getElement('loadExampleBtn');
  loadExampleBtn?.addEventListener('click', handleLoadExample);
  
  // AI generate button
  const aiGenerateBtn = getElement('aiGenerateBtn');
  aiGenerateBtn?.addEventListener('click', handleAIGenerate);
  
  // Toggle visibility button
  const toggleVisibility = getElement('toggleVisibility');
  toggleVisibility?.addEventListener('click', togglePasswordVisibility);
  
  // Theme toggle button
  const themeBtn = document.getElementById('themeBtn');
  themeBtn?.addEventListener('click', handleThemeToggle);
  
  // Help button
  const helpBtn = getElement('helpBtn');
  helpBtn?.addEventListener('click', openHelpModal);
  
  // History search
  const historySearch = getElement('historySearch');
  historySearch?.addEventListener('input', (e) => {
    setSearchQuery(e.target.value);
  });
  
  // History sort
  const historySort = getElement('historySort');
  historySort?.addEventListener('change', (e) => {
    setSortOption(e.target.value);
  });
  
  // Clear history button
  const clearHistoryBtn = getElement('clearHistoryBtn');
  clearHistoryBtn?.addEventListener('click', handleClearHistory);
  
  // Pagination
  const prevPageBtn = getElement('prevPage');
  prevPageBtn?.addEventListener('click', prevPage);
  
  const nextPageBtn = getElement('nextPage');
  nextPageBtn?.addEventListener('click', nextPage);
  
  // History list delegation (for item actions)
  const historyList = getElement('historyList');
  historyList?.addEventListener('click', handleHistoryItemClick);
  
  // Policy form change (save on change)
  const policyForm = getElement('policyForm');
  policyForm?.addEventListener('change', handlePolicyChange);
}

/**
 * Set up keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  // G - Generate password
  registerShortcut('G', handleGenerate);
  
  // C - Copy password
  registerShortcut('C', handleCopy);
  
  // T - Toggle theme
  registerShortcut('T', handleThemeToggle);
  
  // H - Toggle password visibility
  registerShortcut('H', togglePasswordVisibility);
  
  // Escape - Close modal
  registerShortcut('Escape', closeHelpModal);
}

/**
 * Handle generate button click
 */
async function handleGenerate() {
  clearPolicyError();
  
  const policy = getPolicyFromForm();
  const result = generatePassword(policy);
  
  if (!result.success) {
    showPolicyError(result.error);
    return;
  }
  
  // Update display
  updatePasswordDisplay(result.password);
  
  // Evaluate strength
  const evaluation = evaluatePassword(result.password);
  
  // Save to history
  try {
    const entry = {
      password: result.password,
      length: result.password.length,
      entropy: evaluation.entropy,
      strength: evaluation.score,
      strengthLabel: evaluation.label,
      source: 'manual'
    };
    
    const id = await savePasswordEntry(entry);
    addEntry({ ...entry, id, createdAt: new Date().toISOString() });
    
    showToast({
      type: 'success',
      message: 'Password generated successfully!',
      duration: 3000
    });
  } catch (error) {
    console.error('Failed to save password to history:', error);
  }
}

/**
 * Handle copy button click
 */
async function handleCopy() {
  const password = getCurrentPassword();
  
  if (!password || password === '—') {
    showToast({
      type: 'warning',
      message: 'No password to copy'
    });
    return;
  }
  
  try {
    await navigator.clipboard.writeText(password);
    showCopySuccess();
  } catch (error) {
    console.error('Failed to copy:', error);
    showToast({
      type: 'error',
      message: 'Failed to copy password'
    });
  }
}

/**
 * Handle load example policy button click
 */
function handleLoadExample() {
  const examplePolicy = getExamplePolicy();
  setPolicyInForm(examplePolicy);
  
  // Save the example policy
  savePolicyConfig(examplePolicy).catch(console.error);
  
  showToast({
    type: 'info',
    message: 'Example policy loaded. Click Generate to create a password.',
    duration: 4000
  });
  
  announce('Example policy loaded');
}

/**
 * Handle AI generate button click
 */
async function handleAIGenerate() {
  clearAIError();
  
  const prompt = getAIPrompt();
  
  if (!prompt) {
    showAIError('Please describe the kind of password you want.');
    return;
  }
  
  if (!GEMINI_API_KEY) {
    showAIError('Gemini API key is not configured. Set VITE_GEMINI_API_KEY in your .env file.');
    return;
  }
  
  setAILoading(true);
  
  try {
    const password = await generatePasswordWithAI(prompt);
    
    // Update display
    updatePasswordDisplay(password);
    
    // Evaluate strength
    const evaluation = evaluatePassword(password);
    
    // Save to history
    const entry = {
      password: password,
      length: password.length,
      entropy: evaluation.entropy,
      strength: evaluation.score,
      strengthLabel: evaluation.label,
      source: 'ai'
    };
    
    const id = await savePasswordEntry(entry);
    addEntry({ ...entry, id, createdAt: new Date().toISOString() });
    
    showToast({
      type: 'success',
      message: 'AI-generated password created!',
      duration: 3000
    });
  } catch (error) {
    console.error('AI generation failed:', error);
    showAIError(error.message || 'Failed to generate password with AI');
  } finally {
    setAILoading(false);
  }
}

/**
 * Generate password using Gemini AI
 * 
 * @param {string} userPrompt - User's description
 * @returns {Promise<string>} Generated password
 */
async function generatePasswordWithAI(userPrompt) {
  const policy = getPolicyFromForm();
  
  const systemPrompt = `You are a password generator. Based on the description and policy below, generate ONE secure password only.
Rules:
- Length: exactly ${policy.length} characters if possible.
- Minimum uppercase letters: ${policy.minUppercase}
- Minimum lowercase letters: ${policy.minLowercase}
- Minimum digits: ${policy.minDigits}
- Minimum symbols: ${policy.minSymbols}
- ${policy.avoidSimilar ? "Avoid characters that look similar: I, l, 0, O." : "Similar characters are allowed."}
- ${policy.noRepeating ? "Avoid immediately repeated characters like 'aa' or '11'." : "Immediate repeats are allowed."}

Output format:
- Return ONLY the password string.
- No explanations, no backticks, no quotes, no extra text.`;

  const fullPrompt = `User description:\n${userPrompt}\n\nPassword policy:\n${systemPrompt}`;
  
  const response = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      contents: [{ parts: [{ text: fullPrompt }] }] 
    })
  });
  
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  let aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  if (!aiText) {
    throw new Error('Empty response from Gemini');
  }
  
  // Clean up the response
  aiText = aiText.trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, '');
  
  // Truncate if too long
  if (aiText.length > policy.length) {
    aiText = aiText.slice(0, policy.length);
  }
  
  return aiText;
}

/**
 * Handle theme toggle
 */
async function handleThemeToggle() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(currentTheme);
  
  try {
    await saveTheme(currentTheme);
  } catch (error) {
    console.warn('Failed to save theme:', error);
  }
  
  announce(`${currentTheme === 'dark' ? 'Dark' : 'Light'} theme activated`);
}

/**
 * Handle clear history button click
 */
function handleClearHistory() {
  clearAllHistory();
}

/**
 * Handle clicks on history items (delegation)
 * 
 * @param {Event} event
 */
async function handleHistoryItemClick(event) {
  const target = event.target.closest('button');
  if (!target) return;
  
  const item = target.closest('.history-item');
  if (!item) return;
  
  const id = parseInt(item.dataset.id, 10);
  // Password is now stored on the item element itself
  const password = item.dataset.password;
  
  // Toggle visibility
  if (target.classList.contains('history-toggle-visibility')) {
    const passwordEl = item.querySelector('.history-password');
    const eyeIcon = target.querySelector('.eye-icon');
    const eyeOffIcon = target.querySelector('.eye-off-icon');
    
    if (passwordEl && password) {
      // Check if currently showing masked (dots) or actual password
      const isCurrentlyMasked = passwordEl.textContent.includes('•');
      
      if (isCurrentlyMasked) {
        // Show the actual password
        passwordEl.textContent = password;
        eyeIcon?.classList.add('hidden');
        eyeOffIcon?.classList.remove('hidden');
      } else {
        // Hide it (show dots)
        passwordEl.textContent = '•'.repeat(Math.min(password.length, 16));
        eyeIcon?.classList.remove('hidden');
        eyeOffIcon?.classList.add('hidden');
      }
    }
    return;
  }
  
  // Copy
  if (target.classList.contains('history-copy')) {
    if (password) {
      try {
        await navigator.clipboard.writeText(password);
        showToast({
          type: 'success',
          message: 'Password copied!',
          duration: 2000
        });
      } catch (error) {
        showToast({
          type: 'error',
          message: 'Failed to copy'
        });
      }
    }
    return;
  }
  
  // Delete
  if (target.classList.contains('history-delete')) {
    // Add deleting animation
    item.classList.add('deleting');
    
    // Wait for animation then delete
    setTimeout(() => {
      deleteEntry(id);
    }, 200);
    return;
  }
}

/**
 * Handle policy form changes (auto-save)
 */
async function handlePolicyChange() {
  const policy = getPolicyFromForm();
  
  try {
    await savePolicyConfig(policy);
  } catch (error) {
    console.warn('Failed to save policy:', error);
  }
}

/**
 * Set up contact modal
 */
function setupContactModal() {
  const contactBtn = document.getElementById('contactBtn');
  const contactModal = document.getElementById('contactModal');
  const contactForm = document.getElementById('contactForm');
  const contactSuccess = document.getElementById('contactSuccess');
  
  if (!contactBtn || !contactModal) return;
  
  // Open modal on contact button click
  contactBtn.addEventListener('click', (e) => {
    e.preventDefault();
    contactModal.showModal();
  });
  
  // Close on backdrop click
  contactModal.addEventListener('click', (e) => {
    if (e.target === contactModal) {
      contactModal.close();
    }
  });
  
  // Initialize EmailJS with your public key
  if (typeof emailjs !== 'undefined') {
    emailjs.init('fCBFlKJTC1KvgK6Kg');
  }
  
  // Handle form submission
  if (contactForm) {
    console.log('Contact form found, adding submit listener');
    
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('Form submitted');
      
      const submitBtn = contactForm.querySelector('.contact-submit');
      if (!submitBtn) {
        console.error('Submit button not found');
        return;
      }
      
      // Get form values
      const name = document.getElementById('contactName')?.value?.trim() || '';
      const email = document.getElementById('contactEmail')?.value?.trim() || '';
      const subject = document.getElementById('contactSubject')?.value || '';
      const message = document.getElementById('contactMessage')?.value?.trim() || '';
      const newsletter = document.getElementById('contactNewsletter')?.checked ? 'Yes' : 'No';
      
      console.log('Form values:', { name, email, subject, message });
      
      // Validate
      if (!name || !email || !subject || !message) {
        showToast({
          type: 'error',
          message: 'Please fill in all required fields.'
        });
        return;
      }
      
      submitBtn.classList.add('loading');
      
      try {
        // Check if EmailJS is configured
        if (typeof emailjs !== 'undefined') {
          // Send via EmailJS
          await emailjs.send(
            'service_99z5gjc',
            'template_vqyd1ss',
            {
              from_name: name,
              from_email: email,
              subject: subject,
              message: message,
              newsletter: newsletter
            }
          );
          
          // Show success
          contactForm.classList.add('hidden');
          contactSuccess.classList.remove('hidden');
          
          showToast({
            type: 'success',
            message: 'Message sent successfully!',
            duration: 4000
          });
          
          contactForm.reset();
        } else {
          // Fallback to mailto if EmailJS not loaded
          const emailBody = `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\nNewsletter: ${newsletter}\n\nMessage:\n${message}`;
          window.location.href = `mailto:sainiharsh3311@gmail.com?subject=${encodeURIComponent(`[SecurePass] ${subject}`)}&body=${encodeURIComponent(emailBody)}`;
          
          contactForm.classList.add('hidden');
          contactSuccess.classList.remove('hidden');
        }
      } catch (error) {
        console.error('Email send error:', error);
        showToast({
          type: 'error',
          message: 'Failed to send. Please try again or email directly.'
        });
      } finally {
        submitBtn.classList.remove('loading');
      }
    });
  }
  
  // Also add click handler on submit button as backup
  const submitBtn = document.querySelector('.contact-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', (e) => {
      console.log('Submit button clicked');
      // The form submit event should handle this, but log for debugging
    });
  }
  
  // Reset modal state when closed
  contactModal.addEventListener('close', () => {
    if (contactForm && contactSuccess) {
      contactForm.classList.remove('hidden');
      contactSuccess.classList.add('hidden');
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
