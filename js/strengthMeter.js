/**
 * strengthMeter.js - Password Strength Evaluation
 * 
 * This module calculates password entropy and strength ratings.
 * It provides detailed analysis of password security based on:
 * - Character pool size
 * - Password length
 * - Character variety
 */

// Strength levels with their thresholds and labels
const STRENGTH_LEVELS = [
  { maxEntropy: 28, score: 0, label: 'Very Weak', class: 'very-weak' },
  { maxEntropy: 36, score: 1, label: 'Weak', class: 'weak' },
  { maxEntropy: 60, score: 2, label: 'Medium', class: 'medium' },
  { maxEntropy: 80, score: 3, label: 'Strong', class: 'strong' },
  { maxEntropy: Infinity, score: 4, label: 'Very Strong', class: 'very-strong' }
];

/**
 * Calculate the character pool size based on what's in the password
 * 
 * @param {string} password - The password to analyze
 * @returns {number} Size of the character pool
 */
function calculatePoolSize(password) {
  let poolSize = 0;
  
  // Check for lowercase letters (26 chars)
  if (/[a-z]/.test(password)) {
    poolSize += 26;
  }
  
  // Check for uppercase letters (26 chars)
  if (/[A-Z]/.test(password)) {
    poolSize += 26;
  }
  
  // Check for digits (10 chars)
  if (/[0-9]/.test(password)) {
    poolSize += 10;
  }
  
  // Check for common symbols (32 chars)
  if (/[^a-zA-Z0-9]/.test(password)) {
    poolSize += 32;
  }
  
  return poolSize;
}

/**
 * Calculate entropy in bits for a password
 * Entropy = length * log2(poolSize)
 * 
 * @param {string} password - The password to analyze
 * @returns {number} Entropy in bits (rounded)
 */
export function calculateEntropy(password) {
  if (!password || password === '—' || password.length === 0) {
    return 0;
  }
  
  const poolSize = calculatePoolSize(password);
  if (poolSize === 0) return 0;
  
  // Entropy formula: E = L * log2(N)
  // Where L = length, N = pool size
  const entropy = password.length * Math.log2(poolSize);
  
  return Math.round(entropy);
}

/**
 * Get strength level based on entropy
 * 
 * @param {number} entropy - Entropy in bits
 * @returns {Object} Strength level { score, label, class }
 */
function getStrengthLevel(entropy) {
  for (const level of STRENGTH_LEVELS) {
    if (entropy < level.maxEntropy) {
      return { score: level.score, label: level.label, class: level.class };
    }
  }
  // Fallback to strongest
  return { score: 4, label: 'Very Strong', class: 'very-strong' };
}

/**
 * Evaluate a password and return comprehensive strength information
 * 
 * @param {string} password - The password to evaluate
 * @param {Object} policyOptions - Optional policy context (for future enhancements)
 * @returns {Object} Evaluation result
 */
export function evaluatePassword(password, policyOptions = {}) {
  const entropy = calculateEntropy(password);
  const { score, label, class: strengthClass } = getStrengthLevel(entropy);
  
  // Additional analysis
  const analysis = {
    length: password?.length || 0,
    hasLowercase: /[a-z]/.test(password || ''),
    hasUppercase: /[A-Z]/.test(password || ''),
    hasDigits: /[0-9]/.test(password || ''),
    hasSymbols: /[^a-zA-Z0-9]/.test(password || ''),
    poolSize: calculatePoolSize(password || '')
  };
  
  return {
    entropy,
    score,        // 0-4 numeric score
    label,        // Human-readable label
    class: strengthClass, // CSS class name
    analysis
  };
}

/**
 * Get color for strength visualization
 * 
 * @param {number} score - Strength score (0-4)
 * @returns {string} CSS color variable name
 */
export function getStrengthColor(score) {
  const colors = [
    'var(--color-strength-very-weak)',
    'var(--color-strength-weak)',
    'var(--color-strength-medium)',
    'var(--color-strength-strong)',
    'var(--color-strength-very-strong)'
  ];
  return colors[Math.min(score, 4)];
}

/**
 * Get recommendations for improving password strength
 * 
 * @param {Object} evaluation - Result from evaluatePassword
 * @returns {Array<string>} List of recommendations
 */
export function getRecommendations(evaluation) {
  const recommendations = [];
  const { analysis, entropy } = evaluation;
  
  if (analysis.length < 12) {
    recommendations.push('Use at least 12 characters for better security');
  }
  
  if (!analysis.hasLowercase) {
    recommendations.push('Add lowercase letters');
  }
  
  if (!analysis.hasUppercase) {
    recommendations.push('Add uppercase letters');
  }
  
  if (!analysis.hasDigits) {
    recommendations.push('Add numbers');
  }
  
  if (!analysis.hasSymbols) {
    recommendations.push('Add special characters (!@#$%...)');
  }
  
  if (entropy < 60 && analysis.length >= 12) {
    recommendations.push('Mix more character types for higher entropy');
  }
  
  return recommendations;
}
