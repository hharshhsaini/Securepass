/**
 * accessibility.js - Accessibility Features
 * 
 * This module handles accessibility features including:
 * - ARIA attribute management
 * - Keyboard navigation and shortcuts
 * - Arrow key navigation between focusable elements
 * - Focus management
 * - Screen reader announcements
 * - Roving tabindex for button groups
 */

// Keyboard shortcut handlers
const shortcuts = new Map();

// Live region for announcements
let liveRegion = null;

// Track if we're using keyboard navigation
let isKeyboardNavigating = false;

/**
 * Initialize accessibility features
 */
export function initAccessibility() {
  // Create live region for screen reader announcements
  createLiveRegion();
  
  // Set up keyboard shortcuts
  setupKeyboardShortcuts();
  
  // Set up focus trap for modals
  setupFocusTrap();
  
  // Set up focus visibility
  setupFocusVisibility();
  
  // Set up arrow key navigation
  setupArrowKeyNavigation();
  
  // Set up roving tabindex for button groups
  setupRovingTabindex();
  
  // Set up form navigation
  setupFormNavigation();
}

/**
 * Create a live region for screen reader announcements
 */
function createLiveRegion() {
  // Check if already exists
  if (document.getElementById('sr-announcements')) {
    liveRegion = document.getElementById('sr-announcements');
    return;
  }
  
  liveRegion = document.createElement('div');
  liveRegion.id = 'sr-announcements';
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only';
  document.body.appendChild(liveRegion);
}

/**
 * Announce a message to screen readers
 * 
 * @param {string} message - Message to announce
 * @param {string} priority - 'polite' or 'assertive'
 */
export function announce(message, priority = 'polite') {
  if (!liveRegion) {
    createLiveRegion();
  }
  
  liveRegion.setAttribute('aria-live', priority);
  
  // Clear and set message (triggers announcement)
  liveRegion.textContent = '';
  
  // Use setTimeout to ensure the DOM update triggers the announcement
  setTimeout(() => {
    liveRegion.textContent = message;
  }, 50);
}

/**
 * Set up global keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', handleKeyboardShortcut);
}

/**
 * Handle keyboard shortcut events
 * 
 * @param {KeyboardEvent} event
 */
function handleKeyboardShortcut(event) {
  // Don't trigger shortcuts when typing in inputs (except for specific keys)
  const target = event.target;
  const isInput = target.tagName === 'INPUT' || 
                  target.tagName === 'TEXTAREA' || 
                  target.tagName === 'SELECT' ||
                  target.isContentEditable;
  
  // Allow Escape everywhere
  if (event.key === 'Escape') {
    const handler = shortcuts.get('Escape');
    if (handler) {
      event.preventDefault();
      handler();
    }
    // Also blur any focused input
    if (isInput) {
      target.blur();
    }
    return;
  }
  
  // Allow Enter to submit/activate in inputs
  if (event.key === 'Enter' && isInput) {
    // If it's a checkbox, toggle it
    if (target.type === 'checkbox') {
      event.preventDefault();
      target.checked = !target.checked;
      target.dispatchEvent(new Event('change', { bubbles: true }));
      announce(target.checked ? 'Checked' : 'Unchecked');
      return;
    }
    
    // Special handling for AI prompt textarea - Enter triggers generation
    if (target.tagName === 'TEXTAREA' && target.id === 'aiPrompt') {
      // Allow Shift+Enter for new line
      if (event.shiftKey) {
        return; // Let default behavior add new line
      }
      event.preventDefault();
      const aiGenerateBtn = document.getElementById('aiGenerateBtn');
      if (aiGenerateBtn && !aiGenerateBtn.disabled) {
        aiGenerateBtn.click();
        announce('Generating AI password');
      }
      return;
    }
    
    // Skip other textareas (allow normal Enter behavior)
    if (target.tagName === 'TEXTAREA') {
      return;
    }
    
    // Find the nearest form or button group
    const form = target.closest('form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"], button:not([type])');
      if (submitBtn && !submitBtn.disabled) {
        event.preventDefault();
        submitBtn.click();
        announce('Action triggered');
      }
    }
    return;
  }
  
  // Skip other shortcuts when in input
  if (isInput) return;
  
  // Check for registered shortcuts
  const key = event.key.toUpperCase();
  const handler = shortcuts.get(key);
  
  if (handler) {
    event.preventDefault();
    handler();
  }
  
  // Handle "/" for search focus
  if (event.key === '/') {
    event.preventDefault();
    const searchInput = document.getElementById('historySearch');
    if (searchInput) {
      searchInput.focus();
      announce('Search input focused');
    }
  }
  
  // Handle "?" for help
  if (event.key === '?' || (event.shiftKey && event.key === '/')) {
    event.preventDefault();
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
      helpBtn.click();
    }
  }
}

/**
 * Register a keyboard shortcut
 * 
 * @param {string} key - Key to listen for (uppercase)
 * @param {Function} handler - Handler function
 */
export function registerShortcut(key, handler) {
  shortcuts.set(key.toUpperCase(), handler);
}

/**
 * Unregister a keyboard shortcut
 * 
 * @param {string} key - Key to unregister
 */
export function unregisterShortcut(key) {
  shortcuts.delete(key.toUpperCase());
}

/**
 * Set up arrow key navigation for focusable elements
 * Works globally across the entire page
 */
function setupArrowKeyNavigation() {
  document.addEventListener('keydown', (event) => {
    const { key } = event;
    
    // Only handle arrow keys and Home/End
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) {
      return;
    }
    
    const activeElement = document.activeElement;
    if (!activeElement) return;
    
    // Skip if in textarea (allow normal cursor movement)
    if (activeElement.tagName === 'TEXTAREA') return;
    
    // Skip if in text/search input and using left/right (allow cursor movement)
    if (activeElement.tagName === 'INPUT' && 
        ['text', 'search', 'email', 'url', 'tel'].includes(activeElement.type) &&
        (key === 'ArrowLeft' || key === 'ArrowRight')) {
      return;
    }
    
    // Get all focusable elements on the page
    const allFocusables = getAllPageFocusables();
    if (allFocusables.length === 0) return;
    
    const currentIndex = allFocusables.indexOf(activeElement);
    if (currentIndex === -1) return;
    
    let nextIndex = currentIndex;
    
    // Handle navigation
    switch (key) {
      case 'ArrowDown':
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % allFocusables.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + allFocusables.length) % allFocusables.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = allFocusables.length - 1;
        break;
    }
    
    if (nextIndex !== currentIndex) {
      event.preventDefault();
      const nextElement = allFocusables[nextIndex];
      nextElement.focus();
      
      // Announce what we focused on
      announceElement(nextElement);
    }
  });
}

/**
 * Get all focusable elements on the page in DOM order
 * 
 * @returns {HTMLElement[]}
 */
function getAllPageFocusables() {
  const mainContent = document.querySelector('.app-container') || document.body;
  
  return Array.from(mainContent.querySelectorAll(
    'button:not([disabled]), ' +
    'a[href], ' +
    'input:not([disabled]):not([type="hidden"]), ' +
    'select:not([disabled]), ' +
    'textarea:not([disabled]), ' +
    '[tabindex]:not([tabindex="-1"])'
  )).filter(el => {
    // Filter out hidden elements
    if (el.offsetParent === null) return false;
    // Filter out elements in closed dialogs
    const dialog = el.closest('dialog');
    if (dialog && !dialog.open) return false;
    return true;
  });
}

/**
 * Announce the focused element to screen readers
 * 
 * @param {HTMLElement} element
 */
function announceElement(element) {
  let announcement = '';
  
  // Get aria-label first
  if (element.getAttribute('aria-label')) {
    announcement = element.getAttribute('aria-label');
  }
  // Then try title
  else if (element.title) {
    announcement = element.title;
  }
  // Then try associated label
  else if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) {
      announcement = label.textContent?.trim();
    }
  }
  // Then try parent label
  else {
    const parentLabel = element.closest('label, .form-group, .checkbox-label');
    if (parentLabel) {
      const labelText = parentLabel.querySelector('label, span')?.textContent?.trim();
      if (labelText) {
        announcement = labelText;
      }
    }
  }
  // Fallback to text content for buttons
  if (!announcement && element.tagName === 'BUTTON') {
    announcement = element.textContent?.trim();
  }
  // Fallback to placeholder for inputs
  if (!announcement && element.placeholder) {
    announcement = element.placeholder;
  }
  // Fallback to element type
  if (!announcement) {
    const tagName = element.tagName.toLowerCase();
    const type = element.type || '';
    announcement = type ? `${type} ${tagName}` : tagName;
  }
  
  // Add section context if moving to a new section
  const card = element.closest('.card');
  if (card) {
    const cardTitle = card.querySelector('.card-title')?.textContent?.trim();
    if (cardTitle && !announcement.includes(cardTitle)) {
      announcement = `${cardTitle}: ${announcement}`;
    }
  }
  
  announce(announcement);
}



/**
 * Set up roving tabindex for button groups
 */
function setupRovingTabindex() {
  // Find all button groups
  const groups = document.querySelectorAll('.button-group, .history-actions, .header-right');
  
  groups.forEach(group => {
    const buttons = group.querySelectorAll('button:not([disabled])');
    
    // Set tabindex on first button, -1 on others
    buttons.forEach((btn, index) => {
      if (index === 0) {
        btn.setAttribute('tabindex', '0');
      } else {
        btn.setAttribute('tabindex', '-1');
      }
    });
    
    // Update tabindex on focus
    group.addEventListener('focusin', (event) => {
      const focusedBtn = event.target.closest('button');
      if (focusedBtn) {
        buttons.forEach(btn => {
          btn.setAttribute('tabindex', btn === focusedBtn ? '0' : '-1');
        });
      }
    });
  });
}

/**
 * Set up form navigation enhancements
 */
function setupFormNavigation() {
  // Add Enter key support for number inputs to trigger generate
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    
    const target = event.target;
    if (target.tagName === 'INPUT' && target.type === 'number') {
      event.preventDefault();
      const generateBtn = document.getElementById('generateBtn');
      if (generateBtn && !generateBtn.disabled) {
        generateBtn.click();
        generateBtn.focus();
        announce('Password generated');
      }
    }
  });
  
  // Add Tab key cycling within sections
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    
    const activeElement = document.activeElement;
    const card = activeElement?.closest('.card');
    
    // If Shift+Tab on first element of card, or Tab on last element
    // Allow natural tab behavior but announce section change
    if (card) {
      const focusables = getFocusableElements(card);
      const isFirst = focusables[0] === activeElement;
      const isLast = focusables[focusables.length - 1] === activeElement;
      
      if ((event.shiftKey && isFirst) || (!event.shiftKey && isLast)) {
        // Will move to another section
        setTimeout(() => {
          const newCard = document.activeElement?.closest('.card');
          if (newCard && newCard !== card) {
            const title = newCard.querySelector('.card-title');
            if (title) {
              announce(`${title.textContent?.trim()} section`);
            }
          }
        }, 10);
      }
    }
  });
}

/**
 * Set up focus trap for modal dialogs
 */
function setupFocusTrap() {
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    
    const modal = document.querySelector('dialog[open]');
    if (!modal) return;
    
    const focusableElements = getFocusableElements(modal);
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  });
}

/**
 * Get all focusable elements within a container
 * 
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function getFocusableElements(container) {
  return Array.from(container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(el => {
    // Filter out hidden elements
    return el.offsetParent !== null;
  });
}

/**
 * Set up focus visibility (show focus ring only for keyboard navigation)
 */
function setupFocusVisibility() {
  let hadKeyboardEvent = false;
  
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab' || (event.key && event.key.startsWith('Arrow'))) {
      hadKeyboardEvent = true;
      document.body.classList.add('keyboard-navigation');
    }
  });
  
  document.addEventListener('mousedown', () => {
    hadKeyboardEvent = false;
    document.body.classList.remove('keyboard-navigation');
  });
  
  document.addEventListener('focusin', (event) => {
    if (hadKeyboardEvent) {
      event.target.classList.add('focus-visible');
    }
  });
  
  document.addEventListener('focusout', (event) => {
    event.target.classList.remove('focus-visible');
  });
}

/**
 * Set ARIA pressed state for toggle buttons
 * 
 * @param {HTMLElement} button - Button element
 * @param {boolean} pressed - Pressed state
 */
export function setAriaPressed(button, pressed) {
  button.setAttribute('aria-pressed', pressed.toString());
}

/**
 * Set ARIA expanded state for collapsible elements
 * 
 * @param {HTMLElement} trigger - Trigger element
 * @param {boolean} expanded - Expanded state
 */
export function setAriaExpanded(trigger, expanded) {
  trigger.setAttribute('aria-expanded', expanded.toString());
}

/**
 * Set ARIA disabled state
 * 
 * @param {HTMLElement} element - Element
 * @param {boolean} disabled - Disabled state
 */
export function setAriaDisabled(element, disabled) {
  element.setAttribute('aria-disabled', disabled.toString());
  if (disabled) {
    element.setAttribute('tabindex', '-1');
  } else {
    element.removeAttribute('tabindex');
  }
}

/**
 * Move focus to an element
 * 
 * @param {HTMLElement|string} elementOrSelector - Element or selector
 */
export function moveFocus(elementOrSelector) {
  const element = typeof elementOrSelector === 'string' 
    ? document.querySelector(elementOrSelector)
    : elementOrSelector;
    
  if (element) {
    element.focus();
  }
}

/**
 * Trap focus within an element (for modals)
 * 
 * @param {HTMLElement} container - Container element
 * @returns {Function} Cleanup function
 */
export function trapFocus(container) {
  const focusableElements = getFocusableElements(container);
  
  if (focusableElements.length === 0) return () => {};
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  // Store previously focused element
  const previouslyFocused = document.activeElement;
  
  // Focus first element
  firstElement.focus();
  
  const handleKeydown = (event) => {
    if (event.key !== 'Tab') return;
    
    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  };
  
  container.addEventListener('keydown', handleKeydown);
  
  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeydown);
    if (previouslyFocused && previouslyFocused.focus) {
      previouslyFocused.focus();
    }
  };
}

/**
 * Check if user prefers reduced motion
 * 
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get appropriate animation duration based on user preference
 * 
 * @param {number} normalDuration - Normal duration in ms
 * @returns {number} Duration to use
 */
export function getAnimationDuration(normalDuration) {
  return prefersReducedMotion() ? 0 : normalDuration;
}

/**
 * Set up keyboard navigation for a specific element group
 * Call this after dynamically adding content
 * 
 * @param {HTMLElement} container - Container with focusable elements
 */
export function setupGroupNavigation(container) {
  const focusables = getFocusableElements(container);
  
  if (focusables.length === 0) return;
  
  // Set first element as tabbable
  focusables.forEach((el, index) => {
    el.setAttribute('tabindex', index === 0 ? '0' : '-1');
  });
  
  container.addEventListener('keydown', (event) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    
    const currentIndex = focusables.indexOf(document.activeElement);
    if (currentIndex === -1) return;
    
    let nextIndex = currentIndex;
    
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % focusables.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + focusables.length) % focusables.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = focusables.length - 1;
        break;
    }
    
    if (nextIndex !== currentIndex) {
      event.preventDefault();
      
      // Update tabindex
      focusables[currentIndex].setAttribute('tabindex', '-1');
      focusables[nextIndex].setAttribute('tabindex', '0');
      focusables[nextIndex].focus();
    }
  });
}
