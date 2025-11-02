/**
 * coach.js - Voice nudges for focus transitions
 */

import { speak } from './coval.js';

let enabled = false;
let voiceId = null;
let hooks = { onStart: null, onEnd: null };
let lastNudge = 0;
const MIN_INTERVAL_MS = 20000;

export function configure(options = {}) {
  enabled = Boolean(options.enabled);
  voiceId = options.voiceId || null;
}

export function setHooks({ onStart, onEnd } = {}) {
  hooks = {
    onStart: typeof onStart === 'function' ? onStart : null,
    onEnd: typeof onEnd === 'function' ? onEnd : null
  };
}

async function speakLine(line) {
  if (!enabled || !line) return;

  const now = Date.now();
  if (now - lastNudge < MIN_INTERVAL_MS) {
    return;
  }
  lastNudge = now;

  try {
    hooks.onStart && hooks.onStart();
    await speak(line, voiceId);
  } finally {
    hooks.onEnd && hooks.onEnd();
  }
}

export function resetCooldown() {
  lastNudge = 0;
}

export async function nudgeFocus() {
  await speakLine("Let's pick one tab and settle in. I'll cue focus music.");
}

export async function celebrateFlow() {
  await speakLine('Nice—back in flow. Holding steady.');
}

export default {
  configure,
  setHooks,
  nudgeFocus,
  celebrateFlow,
  resetCooldown
};
