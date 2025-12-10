/**
 * passwordGenerator.js - Core Password Generation Logic
 * 
 * This module handles all password generation functionality including:
 * - Cryptographically secure random number generation
 * - Policy-based password creation
 * - Character set management
 * - Validation of policy constraints
 */

// Character sets for password generation
const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

// Characters that look similar and can be confused
const SIMILAR_CHARS = 'Il1O0o';

/**
 * Generate a cryptographically secure random integer
 * Uses crypto.getRandomValues for better randomness than Math.random()
 * 
 * @param {number} max - Upper bound (exclusive)
 * @returns {number} Random integer from 0 to max-1
 */
function getSecureRandomInt(max) {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Use modulo with rejection sampling for uniform distribution
  const limit = Math.floor(0xFFFFFFFF / max) * max;
  let value;
  do {
    crypto.getRandomValues(array);
    value = array[0];
  } while (value >= limit);
  return value % max;
}

/**
 * Securely shuffle an array using Fisher-Yates algorithm
 * 
 * @param {Array} arr - Array to shuffle
 * @returns {Array} New shuffled array
 */
function secureShuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Filter out similar-looking characters from a character set
 * 
 * @param {string} charset - Character set to filter
 * @returns {string} Filtered character set
 */
function filterSimilarChars(charset) {
  return charset.split('').filter(c => !SIMILAR_CHARS.includes(c)).join('');
}

/**
 * Check if a character array has immediate repeating characters
 * 
 * @param {Array<string>} chars - Array of characters
 * @returns {boolean} True if there are immediate repeats
 */
function hasImmediateRepeats(chars) {
  for (let i = 1; i < chars.length; i++) {
    if (chars[i] === chars[i - 1]) return true;
  }
  return false;
}

/**
 * Fix immediate repeating characters by replacing them
 * 
 * @param {Array<string>} chars - Array of characters
 * @param {string} pool - Character pool to use for replacements
 * @returns {Array<string>} Fixed character array
 */
function fixImmediateRepeats(chars, pool) {
  const result = [...chars];
  for (let i = 1; i < result.length; i++) {
    if (result[i] === result[i - 1]) {
      // Try to find a replacement that doesn't create new repeats
      for (let attempt = 0; attempt < 50; attempt++) {
        const replacement = pool[getSecureRandomInt(pool.length)];
        const prevOk = replacement !== result[i - 1];
        const nextOk = i + 1 >= result.length || replacement !== result[i + 1];
        if (prevOk && nextOk) {
          result[i] = replacement;
          break;
        }
      }
    }
  }
  return result;
}

/**
 * Validate password policy options
 * 
 * @param {Object} options - Policy options
 * @returns {Object} Validation result { valid: boolean, error: string|null }
 */
export function validatePolicy(options) {
  const { length, minUppercase, minLowercase, minDigits, minSymbols } = options;
  
  // Check length bounds
  if (length < 4) {
    return { valid: false, error: 'Password length must be at least 4 characters.' };
  }
  if (length > 128) {
    return { valid: false, error: 'Password length cannot exceed 128 characters.' };
  }
  
  // Check minimum requirements don't exceed length
  const minRequired = minUppercase + minLowercase + minDigits + minSymbols;
  if (minRequired > length) {
    return { 
      valid: false, 
      error: `Minimum requirements (${minRequired}) exceed password length (${length}).` 
    };
  }
  
  // Check for negative values
  if (minUppercase < 0 || minLowercase < 0 || minDigits < 0 || minSymbols < 0) {
    return { valid: false, error: 'Minimum values cannot be negative.' };
  }
  
  return { valid: true, error: null };
}

/**
 * Generate a password based on policy options
 * 
 * @param {Object} options - Password policy options
 * @param {number} options.length - Total password length (4-128)
 * @param {number} options.minUppercase - Minimum uppercase letters
 * @param {number} options.minLowercase - Minimum lowercase letters
 * @param {number} options.minDigits - Minimum digits
 * @param {number} options.minSymbols - Minimum symbols
 * @param {boolean} options.avoidSimilar - Avoid similar-looking characters
 * @param {boolean} options.noRepeating - No immediate repeating characters
 * @returns {Object} Result { success: boolean, password: string|null, error: string|null }
 */
export function generatePassword(options) {
  const {
    length = 16,
    minUppercase = 1,
    minLowercase = 1,
    minDigits = 1,
    minSymbols = 1,
    avoidSimilar = true,
    noRepeating = false
  } = options;
  
  // Validate policy first
  const validation = validatePolicy({ length, minUppercase, minLowercase, minDigits, minSymbols });
  if (!validation.valid) {
    return { success: false, password: null, error: validation.error };
  }
  
  // Prepare character sets (optionally filtered)
  let upperChars = avoidSimilar ? filterSimilarChars(CHAR_SETS.uppercase) : CHAR_SETS.uppercase;
  let lowerChars = avoidSimilar ? filterSimilarChars(CHAR_SETS.lowercase) : CHAR_SETS.lowercase;
  let digitChars = avoidSimilar ? filterSimilarChars(CHAR_SETS.digits) : CHAR_SETS.digits;
  let symbolChars = CHAR_SETS.symbols; // Symbols don't have similar chars
  
  // Build password character array
  let passwordChars = [];
  
  // Add minimum required characters from each category
  for (let i = 0; i < minUppercase; i++) {
    passwordChars.push(upperChars[getSecureRandomInt(upperChars.length)]);
  }
  for (let i = 0; i < minLowercase; i++) {
    passwordChars.push(lowerChars[getSecureRandomInt(lowerChars.length)]);
  }
  for (let i = 0; i < minDigits; i++) {
    passwordChars.push(digitChars[getSecureRandomInt(digitChars.length)]);
  }
  for (let i = 0; i < minSymbols; i++) {
    passwordChars.push(symbolChars[getSecureRandomInt(symbolChars.length)]);
  }
  
  // Build pool for remaining characters
  // Include all character types that have minimums, or all if no minimums specified
  let allChars = '';
  const minRequired = minUppercase + minLowercase + minDigits + minSymbols;
  
  if (minRequired === 0) {
    // No specific requirements, use all character types
    allChars = upperChars + lowerChars + digitChars + symbolChars;
  } else {
    // Use character types that have minimums
    if (minUppercase > 0) allChars += upperChars;
    if (minLowercase > 0) allChars += lowerChars;
    if (minDigits > 0) allChars += digitChars;
    if (minSymbols > 0) allChars += symbolChars;
  }
  
  // Fallback if somehow empty
  if (allChars.length === 0) {
    allChars = upperChars + lowerChars + digitChars + symbolChars;
  }
  
  // Fill remaining slots with random characters from the pool
  const remaining = length - passwordChars.length;
  for (let i = 0; i < remaining; i++) {
    passwordChars.push(allChars[getSecureRandomInt(allChars.length)]);
  }
  
  // Shuffle to randomize position of required characters
  passwordChars = secureShuffleArray(passwordChars);
  
  // Handle no-repeating constraint
  if (noRepeating) {
    let attempts = 0;
    // Try shuffling first
    while (hasImmediateRepeats(passwordChars) && attempts < 100) {
      passwordChars = secureShuffleArray(passwordChars);
      attempts++;
    }
    // If still has repeats, fix them directly
    if (hasImmediateRepeats(passwordChars)) {
      passwordChars = fixImmediateRepeats(passwordChars, allChars);
    }
  }
  
  const password = passwordChars.join('');
  return { success: true, password, error: null };
}

/**
 * Get default policy options
 * 
 * @returns {Object} Default policy options
 */
export function getDefaultPolicy() {
  return {
    length: 16,
    minUppercase: 1,
    minLowercase: 1,
    minDigits: 1,
    minSymbols: 1,
    avoidSimilar: true,
    noRepeating: false
  };
}

/**
 * Get example policy for demonstration
 * 
 * @returns {Object} Example policy options
 */
export function getExamplePolicy() {
  return {
    length: 20,
    minUppercase: 2,
    minLowercase: 2,
    minDigits: 2,
    minSymbols: 2,
    avoidSimilar: true,
    noRepeating: true
  };
}
