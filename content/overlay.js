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

  const FALLBACK_MESSAGES = {
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
    ],
    upbeat: [
      "Energy rising—ride the wave!",
      "All smiles here. Let's go!",
      "Bright vibes, bright focus."
    ]
  };

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
    <div class="hmb-bubble neutral" id="hmb-bubble" aria-label="Focus companion planet" tabindex="0">
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
    <div class="hmb-info-panel" id="hmb-info" role="tooltip" aria-live="polite" aria-hidden="true">
      <div class="hmb-info-panel__title" id="hmb-info-title"></div>
      <div class="hmb-info-panel__status-row">
        <span class="hmb-info-panel__label" id="hmb-info-label">Neutral</span>
        <span class="hmb-info-panel__message" id="hmb-info-message">Taking it steady. All good.</span>
      </div>
      <div class="hmb-info-panel__meta" id="hmb-info-meta"></div>
    </div>
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
  const infoPanel = document.getElementById('hmb-info');
  const infoTitleEl = document.getElementById('hmb-info-title');
  const statusLabelEl = document.getElementById('hmb-info-label');
  const statusMessageEl = document.getElementById('hmb-info-message');
  const statusMetaEl = document.getElementById('hmb-info-meta');
  const planetContainer = document.getElementById('hmb-planet-container');
  const faceEl = document.getElementById('hmb-face');

  const rootEl = bubble;
  const POSITION_STORAGE_KEY = 'hmb-planet-position';
  const MIN_DRAG_MARGIN = 18;
  let currentPosition = null;
  const dragState = {
    active: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0
  };

  updateStatus(state.lastStatusMessage);

  applyStoredPosition();
  setInfoVisibility(false);

  if (bubbleEl) {
    bubbleEl.addEventListener('mouseenter', handleInfoHover, { passive: true });
    bubbleEl.addEventListener('mouseleave', handleInfoLeave, { passive: true });
    bubbleEl.addEventListener('focus', handleInfoHover, { passive: true });
    bubbleEl.addEventListener('blur', handleInfoLeave, { passive: true });
    bubbleEl.addEventListener('pointerdown', handlePointerDown);
    bubbleEl.addEventListener('pointermove', handlePointerMove);
    bubbleEl.addEventListener('pointerup', handlePointerUp);
    bubbleEl.addEventListener('pointercancel', handlePointerUp);
  }

  if (infoPanel) {
    infoPanel.addEventListener('mouseenter', handleInfoHover, { passive: true });
    infoPanel.addEventListener('mouseleave', handleInfoLeave, { passive: true });
  }

  window.addEventListener('resize', handleResize, { passive: true });

  const DOMAIN_THEME_PRESETS = [
    { test: host => /(^|\.)news\.ycombinator\.com$/i.test(host), color: '#ff6600' },
    { test: host => /(^|\.)github\.com$/i.test(host), color: '#6f42c1' },
    { test: host => /(^|\.)youtube\.com$/i.test(host), color: '#ff0000' },
    { test: host => /(^|\.)wikipedia\.org$/i.test(host), color: '#36a7e9' }
  ];

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function parseColor(value) {
    if (!value || typeof value !== 'string') return null;
    const input = value.trim().toLowerCase();

    if (input.startsWith('#')) {
      const hex = input.slice(1);
      const normalized = hex.length === 3
        ? hex.split('').map(char => char + char).join('')
        : hex.length === 8
          ? hex.slice(0, 6)
          : hex;
      if (normalized.length !== 6) return null;
      const num = parseInt(normalized, 16);
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
      };
    }

    const rgbMatch = input.match(/^rgba?\(([^)]+)\)$/);
    if (rgbMatch) {
      const parts = rgbMatch[1].split(',').map(part => part.trim());
      if (parts.length >= 3) {
        const r = parseFloat(parts[0]);
        const g = parseFloat(parts[1]);
        const b = parseFloat(parts[2]);
        if ([r, g, b].every(component => Number.isFinite(component))) {
          const alpha = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
          if (!Number.isFinite(alpha) || alpha <= 0) return null;
          return { r, g, b };
        }
      }
    }

    const hslMatch = input.match(/^hsla?\(([^)]+)\)$/);
    if (hslMatch) {
      const parts = hslMatch[1].split(',').map(part => part.trim());
      if (parts.length >= 3) {
        const h = parseFloat(parts[0]);
        const s = parseFloat(parts[1]);
        const l = parseFloat(parts[2]);
        if ([h, s, l].every(component => Number.isFinite(component))) {
          const alpha = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
          if (!Number.isFinite(alpha) || alpha <= 0) return null;
          return hslToRgb({ h, s, l });
        }
      }
    }

    return null;
  }

  function rgbToHsl({ r, g, b }) {
    const rNorm = clamp(r, 0, 255) / 255;
    const gNorm = clamp(g, 0, 255) / 255;
    const bNorm = clamp(b, 0, 255) / 255;

    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const delta = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (delta !== 0) {
      s = delta / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case rNorm:
          h = 60 * (((gNorm - bNorm) / delta) % 6);
          break;
        case gNorm:
          h = 60 * (((bNorm - rNorm) / delta) + 2);
          break;
        case bNorm:
          h = 60 * (((rNorm - gNorm) / delta) + 4);
          break;
      }
    }

    if (h < 0) h += 360;

    return { h, s, l };
  }

  function hslToRgb({ h, s, l }) {
    const hue = ((h % 360) + 360) % 360;
    const saturation = clamp(s, 0, 100) / 100;
    const lightness = clamp(l, 0, 100) / 100;

    const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = lightness - c / 2;

    let r1 = 0;
    let g1 = 0;
    let b1 = 0;

    if (0 <= hue && hue < 60) {
      r1 = c; g1 = x; b1 = 0;
    } else if (60 <= hue && hue < 120) {
      r1 = x; g1 = c; b1 = 0;
    } else if (120 <= hue && hue < 180) {
      r1 = 0; g1 = c; b1 = x;
    } else if (180 <= hue && hue < 240) {
      r1 = 0; g1 = x; b1 = c;
    } else if (240 <= hue && hue < 300) {
      r1 = x; g1 = 0; b1 = c;
    } else {
      r1 = c; g1 = 0; b1 = x;
    }

    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255)
    };
  }

  function mixColors(color, target, factor) {
    const t = clamp(factor, 0, 1);
    return {
      r: Math.round(color.r + (target.r - color.r) * t),
      g: Math.round(color.g + (target.g - color.g) * t),
      b: Math.round(color.b + (target.b - color.b) * t)
    };
  }

  function toRgba(color, alpha = 1) {
    return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${alpha})`;
  }

  function detectPresetColor(hostname) {
    for (const preset of DOMAIN_THEME_PRESETS) {
      try {
        if (preset.test(hostname)) {
          const parsed = parseColor(preset.color);
          if (parsed) {
            return parsed;
          }
        }
      } catch (err) {
        console.warn('[HMB:overlay] Failed to evaluate preset theme', err);
      }
    }
    return null;
  }

  function detectAccentColor() {
    const host = window.location.hostname || '';

    const preset = detectPresetColor(host);
    if (preset) return preset;

    const metaTheme = document.querySelector('meta[name="theme-color" i]');
    if (metaTheme && metaTheme.content) {
      const parsedMeta = parseColor(metaTheme.content);
      if (parsedMeta) return parsedMeta;
    }

    if (document.body) {
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const parsedBg = parseColor(bodyBg);
      if (parsedBg && !isNearNeutral(parsedBg)) {
        return parsedBg;
      }
    }

    const fallback = parseColor('#7e9dff');
    return fallback;
  }

  function isNearNeutral(color) {
    const tolerance = 16;
    const maxComponent = Math.max(color.r, color.g, color.b);
    const minComponent = Math.min(color.r, color.g, color.b);
    return (maxComponent - minComponent) < tolerance;
  }

  function buildPlanetPalette(accentColor) {
    let accent = accentColor;
    if (typeof accent === 'string') {
      accent = parseColor(accent);
    }
    if (!accent) {
      accent = parseColor('#7e9dff');
    }
    const hsl = rgbToHsl(accent);

    const bright = mixColors(accent, { r: 255, g: 255, b: 255 }, 0.25);
    const brighter = mixColors(accent, { r: 255, g: 255, b: 255 }, 0.5);
    const glow = mixColors(accent, { r: 255, g: 255, b: 255 }, 0.65);
    const haloAlt = mixColors(accent, { r: 48, g: 60, b: 120 }, 0.4);
    const depth = mixColors(accent, { r: 16, g: 20, b: 40 }, 0.75);

    const faceStroke = mixColors(accent, { r: 255, g: 255, b: 255 }, 0.7);

    return {
      hue: (hsl.h % 360) / 360,
      colors: {
        primary: toRgba(bright, 0.86),
        secondary: toRgba(brighter, 0.6),
        base: toRgba(depth, 0.92),
        halo: toRgba(glow, 0.7),
        haloAlt: toRgba(haloAlt, 0.55),
        faceStroke: toRgba(faceStroke, 0.95)
      }
    };
  }

  let lastThemeSignature = '';

  function applyBubblePalette(palette) {
    if (!bubbleEl || !palette) return;

    const { colors } = palette;
    const setVar = (el, name, value) => {
      if (!el) return;
      if (value) {
        el.style.setProperty(name, value);
      } else {
        el.style.removeProperty(name);
      }
    };

    setVar(bubbleEl, '--planet-primary', colors.primary);
    setVar(bubbleEl, '--planet-secondary', colors.secondary);
    setVar(bubbleEl, '--planet-tertiary', colors.base);
    setVar(bubbleEl, '--planet-highlight', colors.primary);
    setVar(bubbleEl, '--halo-color', colors.halo);
    setVar(bubbleEl, '--halo-color-alt', colors.haloAlt);
    setVar(bubbleEl, '--face-stroke', colors.faceStroke);

    if (faceEl && colors.faceStroke) {
      faceEl.style.setProperty('color', colors.faceStroke);
      faceEl.style.setProperty('stroke', colors.faceStroke);
    } else if (faceEl) {
      faceEl.style.removeProperty('color');
      faceEl.style.removeProperty('stroke');
    }

    if (planet) {
      planet.setPaletteOverride(palette);
    }
  }

  function updatePlanetTheme(reason = 'auto') {
    const accent = detectAccentColor();
    const signature = accent ? `${Math.round(accent.r)}-${Math.round(accent.g)}-${Math.round(accent.b)}` : 'default';
    if (signature === lastThemeSignature) return;
    lastThemeSignature = signature;

    const palette = buildPlanetPalette(accent);
    applyBubblePalette(palette);
  }

  if (TextCues && TextCues.attachTextListeners) {
    TextCues.attachTextListeners();
  }

  if (PageContext && PageContext.subscribe) {
    PageContext.subscribe((context) => {
      latestPage = context;
      updateStatus(state.lastStatusMessage);
      requestImmediateTick('page-change');
    });
  } else if (PageContext && PageContext.getPageContext) {
    latestPage = PageContext.getPageContext();
    updateStatus(state.lastStatusMessage);
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

  updatePlanetTheme('initial');
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(() => updatePlanetTheme('visible'), 60);
    }
  }, { passive: true });
  window.addEventListener('focus', () => updatePlanetTheme('focus'), { passive: true });

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
        updatePlanetTheme('tab-switch-message');
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

  function handleInfoHover(event) {
    if (dragState.active) return;
    setInfoVisibility(true);
  }

  function handleInfoLeave(event) {
    if (dragState.active) return;
    const related = event?.relatedTarget;
    if (related && rootEl?.contains(related)) {
      return;
    }
    setInfoVisibility(false);
  }

  function setInfoVisibility(visible) {
    if (!rootEl) return;
    if (visible) {
      if (infoPanel) {
        const panelHeight = infoPanel.offsetHeight || 0;
        const rect = rootEl.getBoundingClientRect();
        const fitsAbove = rect.top >= panelHeight + MIN_DRAG_MARGIN;
        if (fitsAbove) {
          rootEl.classList.remove('hmb-root--info-below');
        } else {
          rootEl.classList.add('hmb-root--info-below');
        }
      }
      rootEl.classList.add('hmb-root--show-info');
      infoPanel?.setAttribute('aria-hidden', 'false');
    } else {
      rootEl.classList.remove('hmb-root--show-info');
      rootEl.classList.remove('hmb-root--info-below');
      infoPanel?.setAttribute('aria-hidden', 'true');
    }
  }

  function handlePointerDown(event) {
    if (event.button !== 0 || dragState.active) return;
    dragState.active = true;
    dragState.pointerId = event.pointerId;
    const rect = rootEl.getBoundingClientRect();
    dragState.offsetX = event.clientX - rect.left;
    dragState.offsetY = event.clientY - rect.top;
    rootEl.classList.add('hmb-root--dragging');
    setInfoVisibility(false);
    try {
      bubbleEl?.setPointerCapture(event.pointerId);
    } catch (err) {
      console.debug('[HMB:overlay] Pointer capture unavailable:', err);
    }
  }

  function handlePointerMove(event) {
    if (!dragState.active || dragState.pointerId !== event.pointerId) return;
    const nextX = event.clientX - dragState.offsetX;
    const nextY = event.clientY - dragState.offsetY;
    setRootPosition(nextX, nextY);
  }

  function handlePointerUp(event) {
    if (!dragState.active) return;
    if (dragState.pointerId !== null && event.pointerId !== dragState.pointerId) return;
    dragState.active = false;
    dragState.pointerId = null;
    rootEl.classList.remove('hmb-root--dragging');
    try {
      bubbleEl?.releasePointerCapture(event.pointerId);
    } catch (err) {
      // Ignore
    }
    persistPosition();
    setTimeout(() => setInfoVisibility(false), 0);
  }

  function handleResize() {
    if (!currentPosition) return;
    setRootPosition(currentPosition.x, currentPosition.y);
    persistPosition();
  }

  function applyStoredPosition() {
    if (!rootEl) return;
    let stored = null;
    try {
      const raw = localStorage.getItem(POSITION_STORAGE_KEY);
      if (raw) {
        stored = JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[HMB:overlay] Unable to read stored position:', err);
    }

    if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) {
      setRootPosition(stored.x, stored.y);
      return;
    }

    rootEl.style.right = '22px';
    rootEl.style.bottom = '22px';
    rootEl.style.left = 'auto';
    rootEl.style.top = 'auto';
    currentPosition = null;
  }

  function setRootPosition(x, y) {
    if (!rootEl) return;
    const { x: clampedX, y: clampedY } = clampPosition(x, y);
    rootEl.style.left = `${clampedX}px`;
    rootEl.style.top = `${clampedY}px`;
    rootEl.style.right = 'auto';
    rootEl.style.bottom = 'auto';
    currentPosition = { x: clampedX, y: clampedY };
  }

  function clampPosition(x, y) {
    const width = rootEl?.offsetWidth ?? 0;
    const height = rootEl?.offsetHeight ?? 0;
    const maxX = Math.max(MIN_DRAG_MARGIN, window.innerWidth - width - MIN_DRAG_MARGIN);
    const maxY = Math.max(MIN_DRAG_MARGIN, window.innerHeight - height - MIN_DRAG_MARGIN);
    return {
      x: clamp(x, MIN_DRAG_MARGIN, maxX),
      y: clamp(y, MIN_DRAG_MARGIN, maxY)
    };
  }

  function persistPosition() {
    if (!currentPosition) return;
    try {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(currentPosition));
    } catch (err) {
      console.warn('[HMB:overlay] Unable to persist position:', err);
    }
  }

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
    const pool = FALLBACK_MESSAGES[label] || FALLBACK_MESSAGES.neutral;
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
    if (!statusMessageEl || !statusLabelEl) return;

    const label = titleize(state.label || 'neutral');
    statusLabelEl.textContent = label;

    const safeMessage = message || state.lastStatusMessage || sampleFallbackMessage(state.label);
    statusMessageEl.textContent = safeMessage;

    if (!message && !state.lastStatusMessage) {
      state.lastStatusMessage = safeMessage;
    }

    if (statusMetaEl) {
      statusMetaEl.textContent = formatStatusMeta();
    }

    if (infoTitleEl) {
      const contextTitle = formatContextTitle();
      infoTitleEl.textContent = contextTitle;
      infoTitleEl.setAttribute('title', contextTitle);
    }
  }

  function sampleFallbackMessage(label = 'neutral') {
    const pool = FALLBACK_MESSAGES[label] || FALLBACK_MESSAGES.neutral;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function formatStatusMeta() {
    const stats = state.raw.tabStats || {};
    const parts = [];
    parts.push(`10s:${stats.last10 ?? 0}`);
    parts.push(`60s:${stats.last60 ?? state.raw.tabSwitches60s ?? 0}`);
    if (stats.ratePerMin && stats.ratePerMin > 0) {
      parts.push(`${stats.ratePerMin.toFixed(1)} tabs/min`);
    }
    const host = latestPage?.host || window.location.hostname;
    if (host) {
      parts.push(host.replace(/^www\./, ''));
    }
    return parts.join(' • ');
  }

  function formatContextTitle() {
    const contextTitle = (latestPage?.title || '').trim();
    const fallbackTitle = (document.title || '').trim();
    const titleText = contextTitle || fallbackTitle || 'Current page';
    return titleText.length > 140 ? `${titleText.slice(0, 137)}…` : titleText;
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
