/**
 * musichero.js - MusicHero API client
 */

import * as Sponsor from '../lib/sponsor.js';

const BACKGROUND_ERROR = 'background-unavailable';

function sanitizeUrl(base = '') {
  return base.replace(/\/$/, '');
}

function createPayload({ prompt, lyricHook, durationSec, instrumental }) {
  const body = {
    prompt,
    loop: true
  };

  const parsedDuration = Number(durationSec);
  body.duration = Number.isFinite(parsedDuration) ? parsedDuration : 30;

  if (instrumental !== undefined) {
    body.instrumental = Boolean(instrumental);
  } else {
    body.instrumental = true;
  }

  if (lyricHook) {
    body.lyrics = lyricHook;
  }

  return body;
}

async function requestViaBackground(options) {
  if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
    return { success: false, error: BACKGROUND_ERROR };
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'MUSICHERO_GENERATE', payload: options }, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        console.warn('[HMB:musichero] Background request failed:', lastError.message);
        resolve({ success: false, error: BACKGROUND_ERROR });
        return;
      }
      resolve(response || { success: false, error: 'No response' });
    });
  });
}

export async function generateTrack({ prompt, lyricHook, durationSec = 30, instrumental = true }) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('MusicHero prompt missing');
  }

  const request = createPayload({ prompt, lyricHook, durationSec, instrumental });

  const backgroundResult = await requestViaBackground(request);
  if (backgroundResult.success && backgroundResult.url) {
    return backgroundResult.url;
  }
  if (backgroundResult.error && backgroundResult.error !== BACKGROUND_ERROR) {
    throw new Error(backgroundResult.error);
  }

  const config = await Sponsor.loadConfig();
  if (!config.HMB_USE_MUSICHERO) {
    throw new Error('MusicHero disabled');
  }

  const apiUrl = sanitizeUrl((config.MUSICHERO_API_URL || '').trim());
  const apiKey = (config.MUSICHERO_API_KEY || '').trim();

  if (!apiUrl || !apiKey) {
    throw new Error('MusicHero credentials missing');
  }

  const response = await fetch(`${apiUrl}/v1/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const message = text ? `${response.status} ${text}`.trim() : `${response.status}`;
    throw new Error(`MusicHero request failed (${message})`);
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
