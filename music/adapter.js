/**
 * adapter.js - Music adapter selector
 * Routes to YouTube (default), Spotify, or AI-generated audio
 */

import * as Sponsor from '../lib/sponsor.js';
import { fusePrompt } from '../lib/prompt-fusion.js';
import { getPageContext } from '../lib/page-context.js';
import { extractCues } from '../lib/text-cues.js';
import YouTubeAdapter from './youtube.js';
import SpotifyAdapter from './spotify.js';
import * as MusicHero from './musichero.js';

let baselineAdapter = null;
let configCache = null;
let overlayAudio = null;
let currentMode = null;
let overlayUrl = '';

const overlayCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;
const OVERLAY_TARGET_VOLUME = 0.35;

function preview(value = '', limit = 120) {
  return value.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function hashString(input = '') {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

function buildPageSignature(page = {}) {
  const raw = `${page.host || 'unknown'}|${preview(page.title || '', 80)}|${preview(page.snippet || '', 160)}`;
  return hashString(raw);
}

function buildCuesKey(cues = {}) {
  if (!cues) return 'none';
  const sleepPart = typeof cues.sleepHours === 'number' ? cues.sleepHours : 'na';
  return `${cues.mood || 'none'}-${sleepPart}`;
}

async function ensureConfig() {
  configCache = await Sponsor.loadConfig();
  return configCache;
}

async function ensureAdapter() {
  const config = await ensureConfig();

  if (baselineAdapter) {
    return { adapter: baselineAdapter, config };
  }

  if (config.HMB_USE_SPOTIFY && config.SPOTIFY_CLIENT_ID) {
    console.log('[HMB:music] Using Spotify adapter');
    baselineAdapter = SpotifyAdapter;
  } else {
    console.log('[HMB:music] Using YouTube adapter (default)');
    baselineAdapter = YouTubeAdapter;
  }

  await baselineAdapter.init();
  return { adapter: baselineAdapter, config };
}

function cacheKey({ pageSig, mode, promptHash, cuesKey, instrumental, lyricHook }) {
  return `${pageSig}:${mode}:${promptHash}:${cuesKey}:${instrumental ? 1 : 0}:${lyricHook || ''}`;
}

function getCached(key) {
  const entry = overlayCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    overlayCache.delete(key);
    return null;
  }
  return entry.url;
}

function setCached(key, url) {
  overlayCache.set(key, { url, expires: Date.now() + CACHE_TTL_MS });
}

function ensureOverlayAudio() {
  if (!overlayAudio) {
    overlayAudio = new Audio();
    overlayAudio.loop = true;
    overlayAudio.volume = 0;
    overlayAudio.preload = 'auto';
    overlayAudio.crossOrigin = 'anonymous';
  }
  return overlayAudio;
}

async function fadeTo(audio, target, duration = 900) {
  if (!audio) return;

  const start = audio.volume;
  const delta = target - start;
  const startTime = performance.now();

  return new Promise((resolve) => {
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      audio.volume = start + delta * progress;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

async function playOverlay(url, config) {
  if (!url) return;
  const audio = ensureOverlayAudio();

  if (audio.src !== url) {
    audio.pause();
    audio.src = url;
    overlayUrl = url;
  }

  try {
    await audio.play();
    await fadeTo(audio, config?.MUSICHERO_OVERLAY_VOLUME ?? OVERLAY_TARGET_VOLUME);
  } catch (err) {
    console.warn('[HMB:music] Overlay playback failed:', err);
  }
}

async function stopOverlay() {
  if (!overlayAudio) return;
  try {
    await fadeTo(overlayAudio, 0, 400);
    overlayAudio.pause();
  } catch (err) {
    console.warn('[HMB:music] Failed to fade overlay:', err);
  }
}

export async function init() {
  await ensureAdapter();
}

export async function refreshConfig() {
  configCache = null;
  baselineAdapter = null;
  await stopOverlay();
  overlayUrl = '';
  await ensureAdapter();
}

export async function play(mode, context = {}) {
  const { adapter, config } = await ensureAdapter();

  currentMode = mode;
  await adapter.play(mode);

  if (!shouldUseMusicHero(config)) {
    await stopOverlay();
    return;
  }

  const page = context.page || getPageContext();
  const cues = context.cues || extractCues();
  const state = context.state || { label: context.label || mode };

  const promptConfig = {
    instrumentalOnly: config.MUSICHERO_INSTRUMENTAL_ONLY,
    allowLyric: config.HMB_ALLOW_LYRIC_HOOK,
    durationSec: config.MUSICHERO_DEFAULT_DURATION || 30
  };

  const fusion = fusePrompt(state, page, cues, promptConfig);
  const pageSig = buildPageSignature(page);
  const promptHash = hashString(`${fusion.prompt}|${state.label || ''}`);
  const cuesKey = buildCuesKey(cues);
  const key = cacheKey({
    pageSig,
    mode,
    promptHash,
    cuesKey,
    instrumental: fusion.instrumental,
    lyricHook: fusion.lyricHook
  });

  let url = getCached(key);
  if (!url) {
    try {
      url = await MusicHero.generateTrack(fusion);
      setCached(key, url);
    } catch (err) {
      console.warn('[HMB:music] MusicHero generation failed:', err.message);
      return;
    }
  }

  await playOverlay(url, config);
}

export async function stop() {
  if (baselineAdapter) {
    baselineAdapter.stop();
  }
  await stopOverlay();
  overlayUrl = '';
  currentMode = null;
}

export async function pause() {
  if (baselineAdapter && baselineAdapter.pause) {
    baselineAdapter.pause();
  }
  if (overlayAudio) {
    overlayAudio.pause();
  }
}

export async function resume() {
  if (currentMode && baselineAdapter && baselineAdapter.resume) {
    baselineAdapter.resume();
  } else if (currentMode) {
    await play(currentMode);
  }

  if (overlayAudio && overlayAudio.src) {
    try {
      await overlayAudio.play();
    } catch (err) {
      console.warn('[HMB:music] Unable to resume overlay:', err);
    }
  }
}

export function getStatus() {
  const baselineStatus = baselineAdapter?.getStatus?.() || { isPlaying: false, mode: null };
  const overlayPlaying = !!(overlayAudio && !overlayAudio.paused && overlayAudio.currentTime > 0);
  return {
    ...baselineStatus,
    overlayUrl,
    overlayPlaying
  };
}

function shouldUseMusicHero(config) {
  return Boolean(
    config &&
    config.HMB_USE_MUSICHERO &&
    config.MUSICHERO_API_KEY &&
    config.MUSICHERO_API_URL
  );
}

export default {
  init,
  play,
  stop,
  pause,
  resume,
  getStatus,
  refreshConfig
};
