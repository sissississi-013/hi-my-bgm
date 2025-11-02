/**
 * observe.js - Behavior observation layer
 * Attaches listeners for keyboard, mouse movement
 * Privacy: only stores timestamps, never keystrokes or coordinates
 */

import * as State from './state.js';

let initialized = false;

export function init() {
  if (initialized) return;
  initialized = true;

  // Track keyboard activity (timestamp only)
  document.addEventListener('keydown', () => {
    const now = Date.now();
    State.updateRaw({
      lastInputTime: now,
      lastKeyTime: now
    });
  }, { passive: true });

  // Track mouse movement (timestamp only, no coordinates)
  let mouseThrottle = null;
  document.addEventListener('mousemove', () => {
    if (mouseThrottle) return;
    mouseThrottle = setTimeout(() => {
      mouseThrottle = null;
    }, 500); // Throttle to once per 500ms

    const now = Date.now();
    State.updateRaw({
      lastInputTime: now,
      lastMouseTime: now
    });
  }, { passive: true });

  console.log('[HMB:observe] Observation layer initialized (privacy-safe)');
}

export function getRawSignals() {
  return State.get().raw;
}

export default {
  init,
  getRawSignals
};
