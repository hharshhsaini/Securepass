/**
 * game.js - Password Typing Mini Game
 * 
 * A fun mini-game where users type randomly generated passwords
 * as fast as possible. Score increases with accuracy and speed.
 * All visual animations are CSS-only; JS handles logic and class toggling.
 */

// Game configuration
const CONFIG = {
  baseTime: 10,          // Starting time in seconds
  minTime: 3,            // Minimum time per round
  timeDecrease: 0.5,     // Time decrease per level
  baseLength: 6,         // Starting password length
  maxLength: 20,         // Maximum password length
  lengthIncrease: 1,     // Length increase per level
  scorePerChar: 10,      // Points per character
  bonusMultiplier: 1.5,  // Bonus for fast completion
};

// Character sets for password generation
const CHARS = {
  upper: 'ABCDEFGHJKMNPQRSTUVWXYZ',
  lower: 'abcdefghjkmnpqrstuvwxyz',
  digits: '23456789',
  symbols: '!@#$%&*'
};

// Game state
let state = {
  isPlaying: false,
  score: 0,
  level: 1,
  highScore: 0,
  currentPassword: '',
  timeLeft: CONFIG.baseTime,
  timerId: null
};

// DOM elements
let elements = {};

/**
 * Initialize the game module
 */
export function initGame() {
  cacheElements();
  loadHighScore();
  setupEventListeners();
}

/**
 * Cache DOM element references
 */
function cacheElements() {
  elements = {
    score: document.getElementById('gameScore'),
    level: document.getElementById('gameLevel'),
    timer: document.getElementById('gameTimer'),
    instruction: document.getElementById('gameInstruction'),
    password: document.getElementById('gamePassword'),
    input: document.getElementById('gameInput'),
    feedback: document.getElementById('gameFeedback'),
    startBtn: document.getElementById('gameStartBtn'),
    restartBtn: document.getElementById('gameRestartBtn'),
    highScore: document.getElementById('gameHighScore')
  };
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  elements.startBtn?.addEventListener('click', startGame);
  elements.restartBtn?.addEventListener('click', restartGame);
  elements.input?.addEventListener('input', handleInput);
  elements.input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !state.isPlaying) {
      startGame();
    }
  });
}

/**
 * Load high score from localStorage
 */
function loadHighScore() {
  const saved = localStorage.getItem('passwordGame_highScore');
  state.highScore = saved ? parseInt(saved, 10) : 0;
  updateHighScoreDisplay();
}

/**
 * Save high score to localStorage
 */
function saveHighScore() {
  localStorage.setItem('passwordGame_highScore', state.highScore.toString());
}

/**
 * Generate a random password for the current level
 * 
 * @returns {string} Generated password
 */
function generateGamePassword() {
  const length = Math.min(
    CONFIG.baseLength + (state.level - 1) * CONFIG.lengthIncrease,
    CONFIG.maxLength
  );
  
  // Build character pool based on level
  let pool = CHARS.lower + CHARS.upper;
  if (state.level >= 2) pool += CHARS.digits;
  if (state.level >= 4) pool += CHARS.symbols;
  
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    password += pool[randomIndex];
  }
  
  return password;
}

/**
 * Calculate time for current level
 * 
 * @returns {number} Time in seconds
 */
function calculateTime() {
  const time = CONFIG.baseTime - (state.level - 1) * CONFIG.timeDecrease;
  return Math.max(time, CONFIG.minTime);
}

/**
 * Start a new game
 */
function startGame() {
  state.isPlaying = true;
  state.score = 0;
  state.level = 1;
  
  updateScoreDisplay();
  updateLevelDisplay();
  
  elements.startBtn.disabled = true;
  elements.restartBtn.disabled = false;
  elements.input.disabled = false;
  elements.input.value = '';
  elements.input.focus();
  
  startRound();
}

/**
 * Start a new round
 */
function startRound() {
  // Generate new password
  state.currentPassword = generateGamePassword();
  state.timeLeft = calculateTime();
  
  // Update display
  elements.password.textContent = state.currentPassword;
  elements.password.classList.remove('correct', 'wrong');
  elements.input.value = '';
  elements.input.classList.remove('correct', 'wrong');
  elements.feedback.textContent = '';
  elements.feedback.className = 'game-feedback';
  elements.instruction.textContent = `Type the ${state.currentPassword.length}-character password!`;
  
  updateTimerDisplay();
  
  // Start countdown
  clearInterval(state.timerId);
  state.timerId = setInterval(tick, 1000);
}

/**
 * Timer tick - called every second
 */
function tick() {
  state.timeLeft--;
  updateTimerDisplay();
  
  if (state.timeLeft <= 0) {
    handleTimeout();
  }
}

/**
 * Handle user input
 */
function handleInput() {
  if (!state.isPlaying) return;
  
  const userInput = elements.input.value;
  
  // Check if complete
  if (userInput === state.currentPassword) {
    handleCorrect();
  } else if (userInput.length >= state.currentPassword.length) {
    // Wrong but same length - give feedback
    elements.input.classList.add('wrong');
    setTimeout(() => elements.input.classList.remove('wrong'), 300);
  }
}

/**
 * Handle correct password entry
 */
function handleCorrect() {
  clearInterval(state.timerId);
  
  // Calculate score
  const baseScore = state.currentPassword.length * CONFIG.scorePerChar;
  const timeBonus = state.timeLeft > calculateTime() / 2 
    ? Math.floor(baseScore * (CONFIG.bonusMultiplier - 1))
    : 0;
  const roundScore = baseScore + timeBonus;
  
  state.score += roundScore;
  state.level++;
  
  // Visual feedback (CSS animations via class toggle)
  elements.password.classList.add('correct');
  elements.input.classList.add('correct');
  elements.score.classList.add('score-up');
  setTimeout(() => elements.score.classList.remove('score-up'), 300);
  
  elements.feedback.textContent = `+${roundScore} points${timeBonus > 0 ? ' (Speed Bonus!)' : ''}`;
  elements.feedback.className = 'game-feedback success';
  
  updateScoreDisplay();
  updateLevelDisplay();
  
  // Check high score
  if (state.score > state.highScore) {
    state.highScore = state.score;
    saveHighScore();
    updateHighScoreDisplay();
  }
  
  // Next round after brief delay
  setTimeout(() => {
    if (state.isPlaying) {
      startRound();
    }
  }, 1000);
}

/**
 * Handle timeout (ran out of time)
 */
function handleTimeout() {
  clearInterval(state.timerId);
  
  // Visual feedback
  elements.password.classList.add('wrong');
  elements.input.classList.add('wrong');
  
  elements.feedback.textContent = `Time's up! The password was: ${state.currentPassword}`;
  elements.feedback.className = 'game-feedback error';
  
  endGame();
}

/**
 * End the game
 */
function endGame() {
  state.isPlaying = false;
  
  elements.input.disabled = true;
  elements.startBtn.disabled = false;
  elements.startBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
    Play Again
  `;
  
  elements.instruction.textContent = `Game Over! Final Score: ${state.score}`;
}

/**
 * Restart the game
 */
function restartGame() {
  clearInterval(state.timerId);
  state.isPlaying = false;
  
  elements.password.textContent = 'Press Start to Play';
  elements.password.classList.remove('correct', 'wrong');
  elements.input.value = '';
  elements.input.classList.remove('correct', 'wrong');
  elements.input.disabled = true;
  elements.feedback.textContent = '';
  elements.instruction.textContent = 'Type the password below as fast as you can!';
  
  elements.startBtn.disabled = false;
  elements.startBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
    Start Game
  `;
  elements.restartBtn.disabled = true;
  
  state.score = 0;
  state.level = 1;
  state.timeLeft = CONFIG.baseTime;
  
  updateScoreDisplay();
  updateLevelDisplay();
  updateTimerDisplay();
}

/**
 * Update score display
 */
function updateScoreDisplay() {
  if (elements.score) {
    elements.score.textContent = state.score;
  }
}

/**
 * Update level display
 */
function updateLevelDisplay() {
  if (elements.level) {
    elements.level.textContent = state.level;
  }
}

/**
 * Update timer display
 */
function updateTimerDisplay() {
  if (elements.timer) {
    elements.timer.textContent = state.timeLeft;
    
    // Add warning color when low
    if (state.timeLeft <= 3) {
      elements.timer.style.color = 'var(--color-error)';
    } else {
      elements.timer.style.color = '';
    }
  }
}

/**
 * Update high score display
 */
function updateHighScoreDisplay() {
  if (elements.highScore) {
    elements.highScore.textContent = state.highScore;
  }
}
