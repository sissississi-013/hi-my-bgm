/**
 * overlay.js - Content script with integrated Planet Bubble
 * Runs on every page, observes behavior, renders living planet with audio reactivity
 */

(async function() {
  'use strict';

  // Prevent multiple injections
  if (window.__HMB_INITIALIZED__) {
    return;
  }
  window.__HMB_INITIALIZED__ = true;

  console.log('[HMB:overlay] Initializing Planet Bubble on', window.location.hostname);

  // Load planet bubble and audio analyzer modules dynamically
  let PlanetBubble, AudioAnalyzer;
  let MusicModule = null;
  let PageContext = null;
  let TextCues = null;
  let Rules = null;
  let Coach = null;
  try {
    const planetModule = await import(chrome.runtime.getURL('content/planet-bubble.js'));
    const audioModule = await import(chrome.runtime.getURL('content/audio-analyzer.js'));
    const musicModule = await import(chrome.runtime.getURL('music/adapter.js'));
    const pageModule = await import(chrome.runtime.getURL('lib/page-context.js'));
    const cuesModule = await import(chrome.runtime.getURL('lib/text-cues.js'));
    const rulesModule = await import(chrome.runtime.getURL('lib/rules.js'));
    const coachModule = await import(chrome.runtime.getURL('voice/coach.js'));
    PlanetBubble = planetModule.PlanetBubble || planetModule.default;
    AudioAnalyzer = audioModule.AudioAnalyzer || audioModule.default;
    MusicModule = musicModule.default || musicModule;
    PageContext = pageModule;
    TextCues = cuesModule;
    Rules = rulesModule;
    Coach = coachModule;
    console.log('[HMB:overlay] Modules loaded successfully');
  } catch (err) {
    console.error('[HMB:overlay] Failed to load modules:', err);
    // Continue with basic functionality
  }

  let Music = MusicModule;

  const initTime = Date.now();
  // Create state management
  let state = {
    raw: {
      lastInputTime: initTime,
      lastKeyTime: initTime,
      lastMouseTime: initTime,
      tabSwitches60s: 0,
      tabStats: { last10: 0, last30: 0, last60: 0, ratePerMin: 0 }
    },
    label: 'neutral',
    isPlaying: false,
    lastPageSignature: '',
    lastCueSignature: '',
    lastStatusMessage: ''
  };

  let latestPage = null;
  let latestCues = null;
  let currentConfig = {};

  let tickRunning = false;
  let tickQueued = false;

  function requestImmediateTick(reason = 'manual') {
    if (!tickRunning) {
      tick(reason);
    } else {
      tickQueued = true;
    }
  }

  // Create bubble element with new planet structure
  const bubble = document.createElement('div');
  bubble.id = 'hmb-root';
  bubble.className = 'hmb-root';
  bubble.setAttribute('aria-live', 'polite');
  bubble.setAttribute('role', 'status');

  bubble.innerHTML = `
    <div class="hmb-bubble neutral" id="hmb-bubble" aria-label="Focus companion planet">
      <div class="hmb-halo" id="hmb-halo" aria-hidden="true"></div>
      <div class="hmb-planet-container" id="hmb-planet-container">
        <div class="hmb-planet-glow" aria-hidden="true"></div>
        <div class="hmb-planet-glass" aria-hidden="true"></div>
        <svg
          class="hmb-face"
          id="hmb-face"
          viewBox="0 0 120 120"
          role="presentation"
          data-expression="neutral"
          stroke="currentColor"
          stroke-width="7"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <g class="hmb-face__expression hmb-face__expression--focused" aria-hidden="true">
            <path class="hmb-face__eye" d="M30 58 C38 44 50 44 58 58" />
            <path class="hmb-face__eye" d="M62 58 C70 44 82 44 90 58" />
            <path class="hmb-face__mouth" d="M34 74 C48 96 72 96 86 74" />
          </g>
          <g class="hmb-face__expression hmb-face__expression--neutral" aria-hidden="true">
            <path class="hmb-face__eye" d="M32 60 C40 50 48 50 56 60" />
            <path class="hmb-face__eye" d="M64 60 C72 50 80 50 88 60" />
            <path class="hmb-face__mouth" d="M40 80 C52 84 68 84 80 80" />
          </g>
          <g class="hmb-face__expression hmb-face__expression--distracted" aria-hidden="true">
            <path class="hmb-face__eye" d="M28 56 C38 44 52 48 60 60" />
            <path class="hmb-face__eye" d="M60 64 C72 50 84 48 92 56" />
            <path class="hmb-face__mouth" d="M36 82 C52 66 68 66 84 82" />
          </g>
          <g class="hmb-face__expression hmb-face__expression--idle" aria-hidden="true">
            <path class="hmb-face__eye" d="M30 58 C40 66 50 66 60 58" />
            <path class="hmb-face__eye" d="M60 58 C70 66 80 66 90 58" />
            <path class="hmb-face__mouth" d="M40 84 C52 90 68 90 80 84" />
          </g>
          <g class="hmb-face__expression hmb-face__expression--upbeat" aria-hidden="true">
            <path class="hmb-face__eye" d="M28 58 C38 46 50 46 60 58" />
            <path class="hmb-face__eye" d="M60 58 C70 46 82 46 92 58" />
            <path class="hmb-face__mouth" d="M32 72 C48 98 76 98 92 72" />
          </g>
        </svg>
      </div>
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
  const planetContainer = document.getElementById('hmb-planet-container');
  const faceEl = document.getElementById('hmb-face');

  if (TextCues && TextCues.attachTextListeners) {
    TextCues.attachTextListeners();
  }

  if (PageContext && PageContext.subscribe) {
    PageContext.subscribe((context) => {
      latestPage = context;
      requestImmediateTick('page-change');
    });
  } else if (PageContext && PageContext.getPageContext) {
    latestPage = PageContext.getPageContext();
  }

  if (TextCues && TextCues.subscribe) {
    TextCues.subscribe((cues) => {
      latestCues = cues;
      requestImmediateTick('cue-change');
    });
  }

  currentConfig = await getConfig();
  applyConfig(currentConfig);

  if (bubbleEl) {
    bubbleEl.style.setProperty('--beat-strength', '0');
  }
  // Initialize Planet Bubble
  let planet = null;
  if (PlanetBubble && planetContainer) {
    try {
      planet = new PlanetBubble(planetContainer, { size: 72 });
      console.log('[HMB:overlay] Planet initialized');
    } catch (err) {
      console.error('[HMB:overlay] Planet init failed:', err);
    }
  }

  // Initialize Audio Analyzer
  let audioAnalyzer = null;
  if (AudioAnalyzer) {
    try {
      audioAnalyzer = new AudioAnalyzer();
      audioAnalyzer.init();
      console.log('[HMB:overlay] Audio analyzer initialized');

      if (Coach && Coach.setHooks) {
        Coach.setHooks({
          onStart: () => {
            if (audioAnalyzer) {
              audioAnalyzer.setSpeaking(true);
            }
          },
          onEnd: () => {
            if (audioAnalyzer) {
              setTimeout(() => audioAnalyzer.setSpeaking(false), 300);
            }
          }
        });
      }

      // Try to connect to YouTube player periodically
      const connectAudio = () => {
        const youtubeIframe = document.querySelector('iframe[id="hmb-youtube-player"]');
        if (youtubeIframe && audioAnalyzer) {
          audioAnalyzer.connectToYouTube(youtubeIframe);
        }
      };

      // Check every 2 seconds for YouTube player
      setInterval(connectAudio, 2000);
    } catch (err) {
      console.error('[HMB:overlay] Audio analyzer init failed:', err);
    }
  }

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

    const now = Date.now();
    state.raw.lastInputTime = now;
    state.raw.lastMouseTime = now;
  }, { passive: true });

  // Listen for messages from background and popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, payload } = message;

    switch (type) {
      case 'TAB_ACTIVITY': {
        updateTabStats(payload || {});
        requestImmediateTick('tab-activity');
        break;
      }
      case 'TAB_SWITCHED': {
        if (payload) {
          updateTabStats(payload);
        }
        requestImmediateTick('tab-switch');
        break;
      }
      case 'TAB_BURST': {
        if (payload) {
          updateTabStats(payload);
        }
        if (shouldUseVoiceCoach()) {
          queueCoachNudge();
        }
        requestImmediateTick('tab-burst');
        break;
      }
      case 'GET_STATE': {
        sendResponse({
          label: state.label,
          isPlaying: state.isPlaying,
          raw: state.raw
        });
        break;
      }
      case 'PLAY_MUSIC': {
        if (Music && Music.play) {
          const mode = labelToMode(state.label);
          playForMode(mode).then(() => {
            sendResponse({ success: true });
          }).catch((err) => {
            console.error('[HMB:overlay] Play failed:', err);
            sendResponse({ success: false, error: err.message });
          });
          return true;
        }
        sendResponse({ success: false, error: 'Music module unavailable' });
        break;
      }
      case 'PAUSE_MUSIC': {
        if (Music && Music.pause) {
          Music.pause();
        }
        state.isPlaying = false;
        bubbleEl.classList.remove('playing');
        if (planet) planet.setPlaying(false);
        sendResponse({ success: true });
        break;
      }
      case 'SET_MODE': {
        if (payload && payload.mode && Music && Music.play) {
          if (payload.mode === 'auto') {
            userProfile.manualOverride = false;
            userProfile.overrideMode = null;
            sendResponse({ success: true });
          } else {
            userProfile.manualOverride = true;
            userProfile.overrideMode = payload.mode;
            playForMode(payload.mode).then(() => {
              sendResponse({ success: true });
            }).catch((err) => {
              sendResponse({ success: false, error: err.message });
            });
            return true;
          }
        } else {
          sendResponse({ success: false, error: 'Invalid mode' });
        }
        break;
      }
      default: {
        console.warn('[HMB:overlay] Unknown message type:', type);
        sendResponse({ error: 'Unknown message type' });
      }
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    getConfig().then((config) => {
      applyConfig(config);
      if (Music && Music.refreshConfig) {
        Music.refreshConfig();
      }
    });
  });

  // Load user profile (Metorial or local)
  let userProfile = await loadProfile();

  if (Music && Music.init) {
    await Music.init();
  } else {
    Music = await initFallbackMusic();
  }

  // Initialize voice adapter
  const Voice = await initVoice();

  // Main reasoning loop: every 10 seconds
  const TICK_INTERVAL = 10000;

  async function tick(trigger = 'interval') {
    if (tickRunning) {
      tickQueued = true;
      return;
    }

    tickRunning = true;

    try {
      const signals = computeSignals();
      const newLabel = determineLabel(signals, userProfile);
      const changed = newLabel !== state.label;

      if (!latestPage && PageContext && PageContext.getPageContext) {
        latestPage = PageContext.getPageContext();
      }
      if (!latestCues && TextCues && TextCues.extractCues) {
        latestCues = TextCues.extractCues();
      }

      const pageSig = pageSignature(latestPage);
      const cuesSig = cuesSignature(latestCues);

      if (changed) {
        console.log('[HMB:overlay] State changed:', state.label, '->', newLabel);
        state.label = newLabel;

        updateBubble(newLabel);

        const message = await generateMessage(newLabel, state.raw, userProfile, latestPage, latestCues);
        state.lastStatusMessage = message;
        updateStatus(message);

        if (Voice) {
          if (audioAnalyzer) audioAnalyzer.setSpeaking(true);
          Voice.speak(message).catch((err) => {
            console.warn('[HMB:overlay] Voice failed:', err);
          }).finally(() => {
            if (audioAnalyzer) {
              setTimeout(() => audioAnalyzer.setSpeaking(false), 500);
            }
          });
        }

        if (shouldUseVoiceCoach()) {
          if (newLabel === 'focused') {
            Coach.celebrateFlow?.();
          } else if (newLabel === 'distracted') {
            queueCoachNudge();
          }
        }
      }

      const mode = userProfile.manualOverride && userProfile.overrideMode
        ? userProfile.overrideMode
        : labelToMode(state.label);

      const shouldRefreshMusic = !state.isPlaying || changed || pageSig !== state.lastPageSignature || cuesSig !== state.lastCueSignature;

      if (shouldRefreshMusic) {
        await playForMode(mode, { pageSignatureOverride: pageSig, cuesSignatureOverride: cuesSig });
      }

      if (state.isPlaying && audioAnalyzer && planet) {
        const beat = audioAnalyzer.analyze();
        planet.setBeat(beat);

        if (bubbleEl) {
          bubbleEl.style.setProperty('--beat-strength', beat.toFixed(3));
        }

        if (beat > 0.7) {
          bubbleEl.classList.add('beating');
          setTimeout(() => bubbleEl.classList.remove('beating'), 150);
        }
      } else if (bubbleEl) {
        bubbleEl.style.setProperty('--beat-strength', '0');
      }

      updateStatus(state.lastStatusMessage);
    } catch (err) {
      console.error('[HMB:overlay] Tick error:', err);
    } finally {
      tickRunning = false;
      if (tickQueued) {
        tickQueued = false;
        setTimeout(() => tick('queued'), 120);
      }
    }
  }

  // Run initial tick and start loop
  tick('startup');
  setInterval(() => tick('interval'), TICK_INTERVAL);

  console.log('[HMB:overlay] Planet Bubble active, loop running every 10s');

  // Helper functions

  function computeSignals() {
    const now = Date.now();
    const stats = state.raw.tabStats || {};
    const tabSwitches60s = stats.last60 ?? state.raw.tabSwitches60s ?? 0;
    const tabSwitches30s = stats.last30 ?? Math.min(tabSwitches60s, state.raw.tabSwitches60s ?? 0);
    const tabSwitches10s = stats.last10 ?? 0;
    const tabRatePerMin = stats.ratePerMin ?? tabSwitches60s;
    return {
      tabSwitches60s,
      tabSwitches30s,
      tabSwitches10s,
      tabRatePerMin,
      noTypingSeconds: (now - state.raw.lastKeyTime) / 1000,
      noInputSeconds: (now - state.raw.lastInputTime) / 1000,
      mouseIdleSeconds: (now - state.raw.lastMouseTime) / 1000
    };
  }

  function determineLabel(signals, profile = {}) {
    if (Rules && Rules.deriveLabel) {
      const options = {
        idleSeconds: profile?.sensitivity?.idleTimeout ?? currentConfig.idleTimeout ?? 10,
        tabBurstThreshold: profile?.sensitivity?.distractionThreshold ?? currentConfig.distractionThreshold ?? 5,
        focusTabLimit: 3
      };
      return Rules.deriveLabel(signals, options);
    }

    // Fallback if rules module missing
    const now = Date.now();
    const idleTimeout = (profile?.sensitivity?.idleTimeout ?? currentConfig.idleTimeout ?? 10) * 1000;
    const distractThresh = profile?.sensitivity?.distractionThreshold ?? currentConfig.distractionThreshold ?? 5;

    if (now - state.raw.lastInputTime > idleTimeout) {
      return 'idle';
    }
    if (state.raw.tabSwitches60s > distractThresh) {
      return 'distracted';
    }
    if (now - state.raw.lastKeyTime < 4000) {
      return 'focused';
    }
    return 'neutral';
  }

  function updateTabStats(payload = {}) {
    const counts = payload.counts || {};
    const stats = {
      last10: toNumber(counts.last10 ?? payload.countLast10s, state.raw.tabStats?.last10 ?? 0),
      last30: toNumber(counts.last30, state.raw.tabStats?.last30 ?? 0),
      last60: toNumber(
        counts.last60 ?? counts.last60s ?? payload.countLast60s,
        state.raw.tabStats?.last60 ?? state.raw.tabSwitches60s ?? 0
      ),
      ratePerMin: toNumber(payload.ratePerMin, state.raw.tabStats?.ratePerMin ?? state.raw.tabSwitches60s ?? 0)
    };

    if (stats.last30 < stats.last10) {
      stats.last30 = stats.last10;
    }
    if (stats.last60 < stats.last30) {
      stats.last60 = stats.last30;
    }

    state.raw.tabStats = stats;
    state.raw.tabSwitches60s = stats.last60;
  }

  function updateBubble(label) {
    bubbleEl.className = `hmb-bubble ${label}`;
    if (state.isPlaying) {
      bubbleEl.classList.add('playing');
    }

    if (planet) {
      planet.setMood(label);
    }

    if (faceEl) {
      faceEl.setAttribute('data-expression', label);
    }
  }

  async function playForMode(mode, signatureOverrides = {}) {
    if (!Music || !Music.play) return;

    const duration = Number(currentConfig.MUSICHERO_DEFAULT_DURATION || 30);

    try {
      await Music.play(mode, {
        state: { label: state.label, signals: computeSignals() },
        page: latestPage,
        cues: latestCues,
        options: {
          instrumentalOnly: currentConfig.MUSICHERO_INSTRUMENTAL_ONLY,
          allowLyric: currentConfig.HMB_ALLOW_LYRIC_HOOK,
          durationSec: Number.isFinite(duration) ? duration : 30
        }
      });
      state.isPlaying = true;
      bubbleEl.classList.add('playing');
      if (planet) planet.setPlaying(true);
      if (signatureOverrides.pageSignatureOverride !== undefined) {
        state.lastPageSignature = signatureOverrides.pageSignatureOverride;
      }
      if (signatureOverrides.cuesSignatureOverride !== undefined) {
        state.lastCueSignature = signatureOverrides.cuesSignatureOverride;
      }
    } catch (err) {
      console.warn('[HMB:overlay] Music play failed:', err);
      state.isPlaying = false;
      bubbleEl.classList.remove('playing');
      if (planet) planet.setPlaying(false);
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
    if (currentConfig.HMB_USE_METORIAL && currentConfig.METORIAL_API_KEY) {
      // Load from Metorial (stub)
      console.log('[HMB:overlay] Metorial profile loading not yet implemented');
    }

    // Load from local storage
    return new Promise((resolve) => {
      chrome.storage.sync.get(['userProfile'], (result) => {
        const profile = result.userProfile || {
          sensitivity: {
            idleTimeout: 10,
            distractionThreshold: 5
          }
        };
        if (typeof profile.manualOverride !== 'boolean') {
          profile.manualOverride = false;
        }
        if (!profile.overrideMode) {
          profile.overrideMode = null;
        }
        resolve(profile);
      });
    });
  }

  async function initFallbackMusic() {
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
      },

      pause() {
        this.stop();
      },

      resume() {
        if (this.currentMode) {
          return this.play(this.currentMode);
        }
      }
    };
  }

  async function initVoice() {
    return {
      async speak(text) {
        if (!text) return;

        // Check if Coval is enabled
        if (currentConfig.HMB_USE_COVAL && currentConfig.COVAL_API_KEY) {
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

  async function generateMessage(label, rawSignals, profile, pageContext, cuesContext) {
    // Try LLM integrations if enabled
    if (currentConfig.HMB_USE_CAPTAIN && currentConfig.CAPTAIN_API_KEY) {
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

    const pool = messages[label] || messages.neutral;
    let message = pool[Math.floor(Math.random() * pool.length)];

    const contextLine = buildContextLine(pageContext, cuesContext);
    if (contextLine) {
      message = `${message} ${contextLine}`;
    }

    return message;
  }

  function shouldUseVoiceCoach() {
    return Boolean(Coach && (currentConfig.HMB_USE_VOICE_COACH !== false));
  }

  function updateStatus(message) {
    if (!statusEl) return;
    const prefix = formatStatusPrefix();
    statusEl.textContent = message ? `${prefix} — ${message}` : prefix;
  }

  function formatStatusPrefix() {
    const stats = state.raw.tabStats || {};
    const parts = [titleize(state.label || 'neutral')];
    parts.push(`10s:${stats.last10 ?? 0}`);
    parts.push(`60s:${stats.last60 ?? state.raw.tabSwitches60s ?? 0}`);
    if (stats.ratePerMin && stats.ratePerMin > 0) {
      parts.push(`${stats.ratePerMin.toFixed(1)} tabs/min`);
    }
    if (latestPage && latestPage.host) {
      parts.push(`@ ${latestPage.host.replace(/^www\./, '')}`);
    }
    return parts.join(' • ');
  }

  function titleize(value = '') {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function buildContextLine(pageContext, cuesContext) {
    if (cuesContext) {
      if (typeof cuesContext.sleepHours === 'number' && cuesContext.sleepHours <= 3) {
        return `Running on ${cuesContext.sleepHours} hours of sleep—adding energizing drums.`;
      }
      if (cuesContext.mood === 'tired') {
        return 'Feeling the fatigue—boosting the energy a little.';
      }
      if (cuesContext.mood === 'happy') {
        return 'Mood is bright—keeping the soundtrack upbeat but focused.';
      }
    }

    if (!pageContext) return '';

    const host = (pageContext.host || '').toLowerCase();
    if (host.includes('ycombinator')) {
      return "YC page spotted—let's make something people want.";
    }
    if (host.includes('metorial')) {
      return 'Metorial memory mode engaged—celebrating those notes.';
    }

    const snippet = previewText(pageContext.snippet, 110);
    if (snippet) {
      return `I see “${snippet}”.`;
    }

    if (pageContext.title) {
      return `Locked on ${previewText(pageContext.title, 60)}.`;
    }

    return '';
  }

  function previewText(value = '', limit = 120) {
    return value.replace(/\s+/g, ' ').trim().slice(0, limit);
  }

  function pageSignature(page) {
    if (!page) return '';
    const raw = `${page.host || ''}|${previewText(page.title || '', 80)}|${previewText(page.snippet || '', 160)}`;
    return hashString(raw);
  }

  function cuesSignature(cues) {
    if (!cues) return '';
    const raw = `${cues.mood || 'none'}|${cues.sleepHours ?? 'na'}`;
    return hashString(raw);
  }

  function hashString(input = '') {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(16);
  }

  function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function queueCoachNudge() {
    Coach?.nudgeFocus?.();
  }

  function applyConfig(config) {
    currentConfig = config || {};

    if (PageContext && PageContext.setOptIn) {
      PageContext.setOptIn(currentConfig.HMB_ALLOW_PAGE_CONTEXT !== false);
    }
    if (TextCues && TextCues.setOptIn) {
      TextCues.setOptIn(currentConfig.HMB_ALLOW_TYPED_CUES !== false);
    }
    if (Coach && Coach.configure) {
      Coach.configure({
        enabled: currentConfig.HMB_USE_VOICE_COACH !== false,
        voiceId: currentConfig.COVAL_VOICE_ID
      });
      if (Coach.resetCooldown) {
        Coach.resetCooldown();
      }
    }
  }

  async function getConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (config) => {
        resolve(config || {});
      });
    });
  }

})();
