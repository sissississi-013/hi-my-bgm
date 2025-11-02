/**
 * voice/control.js - Lightweight Web Speech controller for on-device commands
 */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function normalizeCommand(transcript = '') {
  const lower = transcript.toLowerCase().trim();
  if (!lower) return null;

  if (/(mute|silence)/.test(lower) && /(voice|coach|assistant)/.test(lower)) {
    return 'mute';
  }
  if (/(pause|stop|hold)/.test(lower)) {
    return 'pause';
  }
  if (/(resume|continue)/.test(lower)) {
    return 'resume';
  }
  if (/play/.test(lower)) {
    return 'resume';
  }
  if (/refocus/.test(lower)) {
    return 'refocus';
  }
  if (/focus/.test(lower)) {
    return 'focus';
  }
  if (/calm|ambient/.test(lower)) {
    return 'calm';
  }
  if (/auto/.test(lower)) {
    return 'auto';
  }
  return null;
}

export function createVoiceController({ onCommand, onState } = {}) {
  const supported = typeof SpeechRecognition === 'function';
  let recognition = null;
  let enabled = false;
  let listening = false;
  let restartTimer = null;

  function notify(update) {
    if (typeof onState === 'function') {
      onState({
        enabled,
        listening,
        supported,
        ...update
      });
    }
  }

  function ensureRecognition() {
    if (!supported) return null;
    if (recognition) return recognition;

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      if (!event.results || !event.results.length) return;
      const result = event.results[event.results.length - 1];
      if (!result || !result[0]) return;
      const transcript = result[0].transcript;
      const command = normalizeCommand(transcript);
      if (command && typeof onCommand === 'function') {
        onCommand(command);
      }
    };

    recognition.onstart = () => {
      listening = true;
      notify({ listening: true, enabled: true });
    };

    recognition.onend = () => {
      listening = false;
      notify({ listening: false });
      if (enabled) {
        scheduleRestart(400);
      }
    };

    recognition.onerror = (event) => {
      console.warn('[HMB:voice-control] recognition error:', event?.error || event);
      listening = false;
      notify({ listening: false, error: event?.error });
      if (enabled) {
        scheduleRestart(1000);
      }
    };

    return recognition;
  }

  function scheduleRestart(delay = 500) {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      if (enabled) {
        startRecognition();
      }
    }, delay);
  }

  function startRecognition() {
    if (!supported || !enabled) return;
    const instance = ensureRecognition();
    if (!instance) return;
    try {
      instance.start();
    } catch (err) {
      if (err && err.name === 'InvalidStateError') {
        scheduleRestart(800);
      } else {
        console.warn('[HMB:voice-control] start failed:', err);
      }
    }
  }

  function stopRecognition() {
    clearTimeout(restartTimer);
    if (recognition) {
      try {
        recognition.stop();
      } catch (err) {
        // ignore
      }
    }
    listening = false;
    notify({ listening: false });
  }

  function setEnabled(nextEnabled) {
    const shouldEnable = Boolean(nextEnabled) && supported;
    enabled = shouldEnable;
    if (!shouldEnable) {
      stopRecognition();
      notify({ enabled: false });
      return;
    }
    notify({ enabled: true });
    startRecognition();
  }

  function destroy() {
    enabled = false;
    stopRecognition();
    if (recognition) {
      recognition.onresult = null;
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition = null;
    }
  }

  function isSupported() {
    return supported;
  }

  return {
    setEnabled,
    destroy,
    isSupported
  };
}

export default {
  createVoiceController
};
