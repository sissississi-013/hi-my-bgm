/**
 * reason.js - State inference logic
 * Rule-based state detection from behavioral signals + optional profile tuning
 */

/**
 * Infer current focus state from raw signals and user profile
 * @param {Object} raw - Raw behavioral signals (lastInputTime, lastKeyTime, tabSwitchCount)
 * @param {Object} profile - User profile from Metorial (optional)
 * @returns {string} State label: 'focused' | 'neutral' | 'distracted' | 'idle'
 */
export function infer(raw, profile = {}) {
  const now = Date.now();

  // Pull thresholds from profile or use defaults
  const idleTimeout = (profile?.sensitivity?.idleTimeout ?? 10) * 1000; // ms
  const distractThresh = profile?.sensitivity?.distractionThreshold ?? 5;

  // Check idle first (no input for X seconds)
  const timeSinceInput = now - raw.lastInputTime;
  if (timeSinceInput > idleTimeout) {
    return 'idle';
  }

  // Check distraction (high tab switching)
  if (raw.tabSwitchCount > distractThresh) {
    return 'distracted';
  }

  // Check focused (recent keyboard activity)
  const timeSinceKey = now - raw.lastKeyTime;
  if (timeSinceKey < 4000) { // 4 seconds
    return 'focused';
  }

  // Default: neutral
  return 'neutral';
}

/**
 * Map state label to music mode
 * Brainwave-inspired (not medical claims)
 */
export function stateToMode(label) {
  switch (label) {
    case 'focused':
      return 'focus'; // Low-BPM, structured rhythm (Alpha/low-Beta friendly)
    case 'distracted':
      return 'refocus'; // Rhythmic re-engagement, soft percussive build
    case 'idle':
      return 'calm'; // Ambient pads, minimal transients
    case 'neutral':
    default:
      return 'calm';
  }
}

export default {
  infer,
  stateToMode
};
