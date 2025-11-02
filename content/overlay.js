/**
 * overlay.js - Content script that injects the bubble UI
 * Runs on every page, observes behavior, updates bubble state
 */

(async function() {
  'use strict';

  // Prevent multiple injections
  if (window.__HMB_INITIALIZED__) {
    return;
  }
  window.__HMB_INITIALIZED__ = true;

  console.log('[HMB:overlay] Initializing on', window.location.hostname);

  // Dynamically import modules (use chrome.runtime.getURL for extension resources)
  const baseUrl = chrome.runtime.getURL('');

  // Create state management (inline minimal version)
  let state = {
    raw: {
      lastInputTime: Date.now(),
      lastKeyTime: Date.now(),
      tabSwitchCount: 0
    },
    label: 'neutral',
    isPlaying: false
  };

  // Create bubble element
  const bubble = document.createElement('div');
  bubble.id = 'hmb-root';
  bubble.className = 'hmb-root';
  bubble.setAttribute('aria-live', 'polite');
  bubble.setAttribute('role', 'status');

  bubble.innerHTML = `
    <div class="hmb-bubble neutral" id="hmb-bubble">
      <div class="hmb-face" id="hmb-face"></div>
      <div class="hmb-halo" id="hmb-halo"></div>
    </div>
    <div class="hmb-status" id="hmb-status">neutral</div>
  `;

  // Wait for body to be available
  if (!document.body) {
    await new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
  }

  document.body.appendChild(bubble);

  const bubbleEl = document.getElementById('hmb-bubble');
  const statusEl = document.getElementById('hmb-status');

  // Initialize observation (privacy-safe: timestamps only)
  document.addEventListener('keydown', () => {
    const now = Date.now();
    state.raw.lastInputTime = now;
    state.raw.lastKeyTime = now;
  }, { passive: true });

  let mouseThrottle = null;
  document.addEventListener('mousemove', () => {
    if (mouseThrottle) return;
    mouseThrottle = setTimeout(() => mouseThrottle = null, 500);

    state.raw.lastInputTime = Date.now();
  }, { passive: true });

  // Listen for messages from background and popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, payload } = message;

    switch (type) {
      case 'TAB_SWITCHED':
        // From background: update tab switch count
        state.raw.tabSwitchCount = payload.count;
        break;

      case 'GET_STATE':
        // From popup: return current state
        sendResponse({
          label: state.label,
          isPlaying: state.isPlaying,
          raw: state.raw
        });
        break;

      case 'PLAY_MUSIC':
        // From popup: start music
        if (Music) {
          const mode = labelToMode(state.label);
          Music.play(mode).then(() => {
            state.isPlaying = true;
            bubbleEl.classList.add('playing');
            sendResponse({ success: true });
          }).catch(err => {
            console.error('[HMB:overlay] Play failed:', err);
            sendResponse({ success: false, error: err.message });
          });
          return true; // Keep channel open for async
        }
        break;

      case 'PAUSE_MUSIC':
        // From popup: pause music
        if (Music && Music.stop) {
          Music.stop();
          state.isPlaying = false;
          bubbleEl.classList.remove('playing');
        }
        sendResponse({ success: true });
        break;

      case 'SET_MODE':
        // From popup: override mode
        if (payload && payload.mode && Music) {
          if (payload.mode === 'auto') {
            // Resume automatic mode
            userProfile.manualOverride = false;
          } else {
            // Set manual override
            userProfile.manualOverride = true;
            userProfile.overrideMode = payload.mode;
            Music.play(payload.mode).then(() => {
              state.isPlaying = true;
              bubbleEl.classList.add('playing');
              sendResponse({ success: true });
            }).catch(err => {
              sendResponse({ success: false, error: err.message });
            });
            return true; // Keep channel open for async
          }
        }
        sendResponse({ success: true });
        break;

      default:
        console.warn('[HMB:overlay] Unknown message type:', type);
        sendResponse({ error: 'Unknown message type' });
    }
  });

  // Load user profile (Metorial or local)
  let userProfile = await loadProfile();

  // Initialize music adapter
  const Music = await initMusic();

  // Initialize voice adapter
  const Voice = await initVoice();

  // Main reasoning loop: every 10 seconds
  const TICK_INTERVAL = 10000;

  async function tick() {
    try {
      // Infer state from raw signals
      const newLabel = inferState(state.raw, userProfile);
      const changed = newLabel !== state.label;

      if (changed) {
        console.log('[HMB:overlay] State changed:', state.label, '->', newLabel);
        state.label = newLabel;

        // Update bubble UI
        updateBubble(newLabel);

        // Generate supportive message
        const message = await generateMessage(newLabel, state.raw, userProfile);
        statusEl.textContent = message;

        // Speak message if voice enabled
        if (Voice && changed) {
          Voice.speak(message).catch(err => {
            console.warn('[HMB:overlay] Voice failed:', err);
          });
        }

        // Update music
        await applyMusic(newLabel, Music);
      }
    } catch (err) {
      console.error('[HMB:overlay] Tick error:', err);
    }
  }

  // Run initial tick and start loop
  tick();
  setInterval(tick, TICK_INTERVAL);

  console.log('[HMB:overlay] Bubble active, loop running every 10s');

  // Helper functions

  function inferState(raw, profile = {}) {
    const now = Date.now();
    const idleTimeout = (profile?.sensitivity?.idleTimeout ?? 10) * 1000;
    const distractThresh = profile?.sensitivity?.distractionThreshold ?? 5;

    if (now - raw.lastInputTime > idleTimeout) {
      return 'idle';
    }
    if (raw.tabSwitchCount > distractThresh) {
      return 'distracted';
    }
    if (now - raw.lastKeyTime < 4000) {
      return 'focused';
    }
    return 'neutral';
  }

  function updateBubble(label) {
    bubbleEl.className = `hmb-bubble ${label}`;
    if (state.isPlaying) {
      bubbleEl.classList.add('playing');
    }
  }

  async function applyMusic(label, musicAdapter) {
    if (!musicAdapter) return;

    const mode = labelToMode(label);
    try {
      await musicAdapter.play(mode);
      state.isPlaying = true;
      bubbleEl.classList.add('playing');
    } catch (err) {
      console.warn('[HMB:overlay] Music play failed:', err);
      state.isPlaying = false;
      bubbleEl.classList.remove('playing');
    }
  }

  function labelToMode(label) {
    switch (label) {
      case 'focused': return 'focus';
      case 'distracted': return 'refocus';
      case 'idle':
      case 'neutral':
      default: return 'calm';
    }
  }

  async function loadProfile() {
    // Try Metorial integration
    const config = await getConfig();

    if (config.HMB_USE_METORIAL && config.METORIAL_API_KEY) {
      // Load from Metorial (stub)
      console.log('[HMB:overlay] Metorial profile loading not yet implemented');
    }

    // Load from local storage
    return new Promise((resolve) => {
      chrome.storage.sync.get(['userProfile'], (result) => {
        resolve(result.userProfile || {
          sensitivity: {
            idleTimeout: 10,
            distractionThreshold: 5
          }
        });
      });
    });
  }

  async function initMusic() {
    // Simple YouTube adapter inline
    return {
      currentPlayer: null,
      currentMode: null,

      async play(mode) {
        const videos = {
          focus: ['jfKfPfyJRdk', '5qap5aO4i9A', 'lTRiuFIWV54'],
          refocus: ['DWcJFNfaw9c', '7NOSDKb0HlU', 'bmVKaAV_7-A'],
          calm: ['1ZYbU82GVz4', 'UfcAVejslrU', 'kJnKt4cxf6M']
        };

        if (this.currentMode === mode && this.currentPlayer) {
          return; // Already playing this mode
        }

        const videoId = videos[mode]?.[Math.floor(Math.random() * videos[mode].length)] || videos.calm[0];

        // Remove old player
        if (this.currentPlayer) {
          this.currentPlayer.remove();
        }

        // Create hidden iframe
        const iframe = document.createElement('iframe');
        iframe.id = 'hmb-youtube-player';
        iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
        iframe.allow = 'autoplay';
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&loop=1&playlist=${videoId}&controls=0`;

        document.body.appendChild(iframe);
        this.currentPlayer = iframe;
        this.currentMode = mode;
      },

      stop() {
        if (this.currentPlayer) {
          this.currentPlayer.remove();
          this.currentPlayer = null;
        }
        this.currentMode = null;
      }
    };
  }

  async function initVoice() {
    const config = await getConfig();

    return {
      async speak(text) {
        if (!text) return;

        // Check if Coval is enabled
        if (config.HMB_USE_COVAL && config.COVAL_API_KEY) {
          // Would call Coval API here
          console.log('[HMB:voice] Coval TTS not yet implemented, using Web Speech');
        }

        // Fallback to Web Speech API
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9;
          utterance.pitch = 1.0;
          utterance.volume = 0.8;
          window.speechSynthesis.speak(utterance);
        }
      }
    };
  }

  async function generateMessage(state, rawSignals, profile) {
    const config = await getConfig();

    // Try LLM integrations if enabled
    if (config.HMB_USE_CAPTAIN && config.CAPTAIN_API_KEY) {
      // Would call Captain API
      console.log('[HMB:llm] Captain integration not yet fully wired in content script');
    }

    // Local fallback messages
    const messages = {
      focused: [
        "You're in the zone! Keep going.",
        "Great focus. You've got this.",
        "Flowing nicely. Stay with it."
      ],
      neutral: [
        "Taking it steady. All good.",
        "Finding your rhythm.",
        "No rush, you're doing fine."
      ],
      distracted: [
        "Lots happening. Let's refocus gently.",
        "It's okay. One thing at a time.",
        "Breathe. You can return to center."
      ],
      idle: [
        "Taking a break? That's wise.",
        "Rest is part of the process.",
        "Recharging. Come back when ready."
      ]
    };

    const pool = messages[state] || messages.neutral;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  async function getConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (config) => {
        resolve(config || {});
      });
    });
  }

})();
