/**
 * musichero.js - MusicHero API client
 */

import * as Sponsor from '../lib/sponsor.js';

export async function generateTrack({ prompt, lyricHook, durationSec = 30, instrumental = true }) {
  const config = await Sponsor.loadConfig();
  if (!config.HMB_USE_MUSICHERO) {
    throw new Error('MusicHero disabled');
  }

  const apiUrl = (config.MUSICHERO_API_URL || '').trim();
  const apiKey = (config.MUSICHERO_API_KEY || '').trim();

  if (!apiUrl || !apiKey) {
    throw new Error('MusicHero credentials missing');
  }

  const body = {
    prompt,
    duration: durationSec,
    loop: true,
    instrumental: Boolean(instrumental)
  };

  if (lyricHook) {
    body.lyrics = lyricHook;
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/v1/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`MusicHero request failed (${response.status})`);
  }

  const payload = await response.json();
  const url = payload.streamUrl || payload.audio_url || payload.download_link || payload.url;
  if (!url) {
    throw new Error('MusicHero response missing audio URL');
  }

  return url;
}

export default {
  generateTrack
};
