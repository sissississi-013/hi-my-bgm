/**
 * text-cues.js - Typed text cue extraction (opt-in, ephemeral)
 */

let buffer = '';
let optIn = true;
let listenersAttached = false;
let lastSignature = '';
const listeners = new Set();

function hasDom() {
  return typeof document !== 'undefined';
}

function isHtmlInput(value) {
  return typeof HTMLInputElement !== 'undefined' && value instanceof HTMLInputElement;
}

function isHtmlTextArea(value) {
  return typeof HTMLTextAreaElement !== 'undefined' && value instanceof HTMLTextAreaElement;
}

function isHtmlElement(value) {
  return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function computeCues() {
  if (!optIn) {
    return {};
  }

  const lower = buffer.toLowerCase();

  const sleepPatterns = [
    /\b(slept|sleep)\b.*?\b(\d{1,2})\s*(h|hr|hrs|hours)\b/,
    /\b(\d{1,2})\s*(h|hr|hrs|hours)\b.*\b(sleep)\b/,
    /\brunning on\s+(\d{1,2})\s*(h|hr|hrs|hours)\b.*\b(sleep)\b/
  ];

  let sleepHours;
  for (const pattern of sleepPatterns) {
    const match = lower.match(pattern);
    if (match) {
      const numeric = match.slice(1).find((part) => part && /\d/.test(part));
      if (numeric) {
        const parsed = parseInt(numeric, 10);
        if (Number.isFinite(parsed)) {
          sleepHours = parsed;
          break;
        }
      }
    }
  }

  const tiredPhrases = /(so tired|exhausted|burned out|low energy|running on fumes|need more sleep)/;
  const happyPhrases = /(so happy|feeling great|good mood|energized)/;
  let mood = null;

  if (happyPhrases.test(lower)) {
    mood = 'happy';
  } else if (tiredPhrases.test(lower)) {
    mood = 'tired';
  }

  if (!mood && typeof sleepHours === 'number' && sleepHours <= 4) {
    mood = 'tired';
  }

  return { sleepHours, mood };
}

function notifyListeners() {
  const cues = computeCues();
  const signature = JSON.stringify(cues);
  if (signature === lastSignature) {
    return cues;
  }
  lastSignature = signature;
  listeners.forEach((listener) => {
    try {
      listener({ ...cues });
    } catch (err) {
      console.error('[HMB:text-cues] Listener error', err);
    }
  });
  return cues;
}

export function setOptIn(value) {
  optIn = Boolean(value);
  if (!optIn) {
    buffer = '';
  }
  lastSignature = '';
  notifyListeners();
}

function attachListener() {
  if (listenersAttached || !hasDom()) return;
  listenersAttached = true;

  document.addEventListener('input', (event) => {
    if (!optIn) return;

    const target = event.target;
    if (!target) return;

    const isEditable =
      isHtmlInput(target) ||
      isHtmlTextArea(target) ||
      (isHtmlElement(target) && target.isContentEditable);

    if (!isEditable) return;

    const value = (target.value || target.textContent || '').slice(-160);
    buffer = (buffer + ' ' + value).slice(-500);
    notifyListeners();
  }, true);
}

export function attachTextListeners() {
  attachListener();
}

export function extractCues() {
  return optIn ? { ...computeCues() } : {};
}

export function subscribe(listener) {
  if (typeof listener !== 'function') return () => {};
  attachListener();
  listeners.add(listener);
  listener(extractCues());
  return () => {
    listeners.delete(listener);
  };
}

export default {
  setOptIn,
  attachTextListeners,
  extractCues,
  subscribe
};
