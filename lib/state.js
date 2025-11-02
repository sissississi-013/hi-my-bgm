/**
 * state.js - Central state management for HI MY BGM
 * Holds raw behavioral signals, computed state label, and playback status
 */

let state = {
  // Raw observational data
  raw: {
    lastInputTime: Date.now(),
    lastKeyTime: Date.now(),
    lastMouseTime: Date.now(),
    tabSwitchCount: 0,
    tabSwitchResetTime: Date.now()
  },
  // Computed state
  label: 'neutral', // focused | neutral | distracted | idle
  previousLabel: null,
  // Music status
  isPlaying: false,
  currentMode: null, // focus | refocus | calm
  // Session tracking
  sessionStart: Date.now(),
  stateHistory: [] // { label, timestamp, duration }
};

export function get() {
  return state;
}

export function update(partial) {
  state = { ...state, ...partial };
  return state;
}

export function updateRaw(rawPartial) {
  state.raw = { ...state.raw, ...rawPartial };
  return state;
}

export function bumpTabSwitches(n = 1) {
  const now = Date.now();
  // Reset counter every 10 seconds
  if (now - state.raw.tabSwitchResetTime > 10000) {
    state.raw.tabSwitchCount = n;
    state.raw.tabSwitchResetTime = now;
  } else {
    state.raw.tabSwitchCount += n;
  }
  return state;
}

export function updateLabel(newLabel) {
  if (state.label !== newLabel) {
    // Record transition
    const now = Date.now();
    const lastEntry = state.stateHistory[state.stateHistory.length - 1];
    if (lastEntry) {
      lastEntry.duration = now - lastEntry.timestamp;
    }

    state.stateHistory.push({
      label: newLabel,
      timestamp: now,
      duration: 0
    });

    state.previousLabel = state.label;
    state.label = newLabel;
  }
  return state;
}

export function setPlaying(isPlaying, mode = null) {
  state.isPlaying = isPlaying;
  if (mode) {
    state.currentMode = mode;
  }
  return state;
}

export function getSessionSummary() {
  const now = Date.now();
  const duration = Math.floor((now - state.sessionStart) / 1000);

  // Build histogram
  const histogram = {};
  state.stateHistory.forEach(entry => {
    histogram[entry.label] = (histogram[entry.label] || 0) + entry.duration;
  });

  return {
    startedAt: state.sessionStart,
    durationSec: duration,
    stateHistogram: histogram,
    totalStates: state.stateHistory.length
  };
}

export default {
  get,
  update,
  updateRaw,
  bumpTabSwitches,
  updateLabel,
  setPlaying,
  getSessionSummary
};
