/**
 * adapter.js - Music adapter selector
 * Routes to YouTube (default), Spotify, or AI-generated audio
 */

import * as Sponsor from '../lib/sponsor.js';
import YouTubeAdapter from './youtube.js';
import SpotifyAdapter from './spotify.js';
import AIOpenAIAdapter from './ai-openai.js';

let currentAdapter = null;

/**
 * Initialize the music adapter based on configuration
 */
export async function init() {
  const config = await Sponsor.loadConfig();

  // Priority: Spotify > YouTube (default)
  if (config.HMB_USE_SPOTIFY && config.SPOTIFY_CLIENT_ID) {
    console.log('[HMB:music] Using Spotify adapter');
    currentAdapter = SpotifyAdapter;
  } else {
    console.log('[HMB:music] Using YouTube adapter (default)');
    currentAdapter = YouTubeAdapter;
  }

  await currentAdapter.init();
}

/**
 * Play music for a specific mode
 * @param {string} mode - 'focus' | 'refocus' | 'calm'
 */
export async function play(mode) {
  if (!currentAdapter) {
    await init();
  }
  return currentAdapter.play(mode);
}

/**
 * Stop music playback
 */
export function stop() {
  if (!currentAdapter) return;
  return currentAdapter.stop();
}

/**
 * Pause music playback
 */
export function pause() {
  if (!currentAdapter) return;
  return currentAdapter.pause();
}

/**
 * Resume music playback
 */
export function resume() {
  if (!currentAdapter) return;
  return currentAdapter.resume();
}

/**
 * Get current playback status
 */
export function getStatus() {
  if (!currentAdapter) return { isPlaying: false, mode: null };
  return currentAdapter.getStatus();
}

export default {
  init,
  play,
  stop,
  pause,
  resume,
  getStatus
};
