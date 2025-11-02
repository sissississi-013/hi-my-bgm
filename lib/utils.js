/**
 * utils.js - Shared utility functions
 */

/**
 * Safely parse JSON from storage
 */
export function parseJSON(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Debounce function calls
 */
export function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle function calls
 */
export function throttle(fn, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}

/**
 * Generate a random ID
 */
export function randomId(prefix = 'hmb') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Wait for a specified duration
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clamp a number between min and max
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Get emoji for state
 */
export function getEmoji(state) {
  switch (state) {
    case 'focused': return '😄';
    case 'neutral': return '😐';
    case 'distracted': return '😟';
    case 'idle': return '😴';
    default: return '😐';
  }
}

/**
 * Get color for state
 */
export function getColor(state) {
  switch (state) {
    case 'focused': return '#00bcd4'; // cyan
    case 'neutral': return '#9e9e9e'; // gray
    case 'distracted': return '#ff5722'; // orange-red
    case 'idle': return '#4caf50'; // green
    default: return '#9e9e9e';
  }
}

export default {
  parseJSON,
  debounce,
  throttle,
  randomId,
  sleep,
  clamp,
  getEmoji,
  getColor
};
