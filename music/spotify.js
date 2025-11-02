/**
 * spotify.js - Spotify Web Playback SDK backend (optional)
 * Requires OAuth and premium account
 *
 * Stub implementation - requires additional setup:
 * 1. OAuth flow for authentication
 * 2. Web Playback SDK initialization
 * 3. Playlist/track management
 */

import * as Sponsor from '../lib/sponsor.js';

let player = null;
let deviceId = null;
let accessToken = null;
let currentMode = null;
let isPlaying = false;

// Curated Spotify playlist URIs for each mode
const PLAYLISTS = {
  focus: 'spotify:playlist:37i9dQZF1DWZeKCadgRdKQ', // Focus Flow
  refocus: 'spotify:playlist:37i9dQZF1DX3rxVfibe1L0', // Mood Booster
  calm: 'spotify:playlist:37i9dQZF1DWZqd5JICZI0u'  // Calm Vibes
};

export async function init() {
  const enabled = await Sponsor.isEnabled('HMB_USE_SPOTIFY');
  if (!enabled) {
    console.log('[HMB:spotify] Spotify integration disabled');
    return;
  }

  const clientId = await Sponsor.getKey('SPOTIFY_CLIENT_ID');
  if (!clientId) {
    console.warn('[HMB:spotify] No Spotify client ID configured');
    return;
  }

  // TODO: Implement OAuth flow
  // 1. Redirect to Spotify authorization
  // 2. Handle callback and exchange code for token
  // 3. Initialize Web Playback SDK
  // See: https://developer.spotify.com/documentation/web-playback-sdk/

  console.log('[HMB:spotify] Spotify adapter stub (not implemented)');
}

export async function play(mode) {
  if (!player || !accessToken) {
    console.warn('[HMB:spotify] Player not initialized');
    return;
  }

  const playlistUri = PLAYLISTS[mode] || PLAYLISTS.calm;

  // TODO: Use Spotify Web API to start playback
  // fetch('https://api.spotify.com/v1/me/player/play', {
  //   method: 'PUT',
  //   headers: {
  //     'Authorization': `Bearer ${accessToken}`,
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify({
  //     context_uri: playlistUri,
  //     device_id: deviceId
  //   })
  // });

  currentMode = mode;
  isPlaying = true;
}

export function stop() {
  if (player) {
    player.pause();
  }
  isPlaying = false;
  currentMode = null;
}

export function pause() {
  if (player) {
    player.pause();
  }
  isPlaying = false;
}

export function resume() {
  if (player) {
    player.resume();
  }
  isPlaying = true;
}

export function getStatus() {
  return {
    isPlaying,
    mode: currentMode
  };
}

export default {
  init,
  play,
  stop,
  pause,
  resume,
  getStatus
};
