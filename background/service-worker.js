/**
 * service-worker.js - Background service worker (MV3)
 * Handles tab activity tracking, message routing, and extension lifecycle
 */

// Import tab activity tracking
importScripts('tab-activity.js');

console.log('[HMB:background] Service worker initialized');

function getMusicHeroConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([
      'HMB_USE_MUSICHERO',
      'MUSICHERO_API_URL',
      'MUSICHERO_API_KEY',
      'MUSICHERO_INSTRUMENTAL_ONLY',
      'MUSICHERO_DEFAULT_DURATION',
      'HMB_ALLOW_LYRIC_HOOK'
    ], (config) => {
      resolve(config || {});
    });
  });
}

async function handleMusicHeroGenerate(payload = {}, sendResponse) {
  try {
    const config = await getMusicHeroConfig();
    if (!config.HMB_USE_MUSICHERO) {
      sendResponse({ success: false, error: 'MusicHero disabled' });
      return;
    }

    const apiUrl = (config.MUSICHERO_API_URL || '').trim().replace(/\/$/, '');
    const apiKey = (config.MUSICHERO_API_KEY || '').trim();

    if (!apiUrl || !apiKey) {
      sendResponse({ success: false, error: 'MusicHero credentials missing' });
      return;
    }

    if (!payload.prompt) {
      sendResponse({ success: false, error: 'MusicHero prompt missing' });
      return;
    }

    const configDuration = Number(config.MUSICHERO_DEFAULT_DURATION);
    const defaultDuration = Number.isFinite(configDuration) ? configDuration : 30;

    const body = {
      prompt: payload.prompt,
      duration: Number.isFinite(payload.duration) ? payload.duration : defaultDuration,
      loop: true,
      instrumental: payload.instrumental !== undefined ? Boolean(payload.instrumental) : true
    };

    if (payload.lyrics || payload.lyricHook) {
      body.lyrics = payload.lyrics || payload.lyricHook;
    }

    const response = await fetch(`${apiUrl}/v1/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const message = text ? `${response.status} ${text}`.trim() : `${response.status}`;
      sendResponse({ success: false, error: `MusicHero request failed (${message})` });
      return;
    }

    const data = await response.json();
    const url = data.streamUrl || data.audio_url || data.download_link || data.url;
    if (!url) {
      sendResponse({ success: false, error: 'MusicHero response missing audio URL' });
      return;
    }

    sendResponse({ success: true, url });
  } catch (err) {
    console.error('[HMB:background] MusicHero generate failed:', err);
    sendResponse({ success: false, error: err.message || 'MusicHero error' });
  }
}

// Initialize on install
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[HMB:background] Extension installed/updated:', details.reason);

  // Set default configuration
  chrome.storage.sync.get(['HMB_USE_YOUTUBE'], (result) => {
    if (result.HMB_USE_YOUTUBE === undefined) {
      chrome.storage.sync.set({
        HMB_USE_YOUTUBE: true,
        HMB_USE_CAPTAIN: false,
        HMB_USE_METORIAL: false,
        HMB_USE_COVAL: false,
        HMB_USE_OPENAI: false,
        HMB_USE_ANTHROPIC: false,
        HMB_USE_SPOTIFY: false,
        HMB_USE_MUSICHERO: false,
        MUSICHERO_API_URL: '',
        MUSICHERO_API_KEY: '',
        MUSICHERO_INSTRUMENTAL_ONLY: true,
        MUSICHERO_DEFAULT_DURATION: 30,
        HMB_ALLOW_LYRIC_HOOK: true,
        HMB_ALLOW_PAGE_CONTEXT: true,
        HMB_ALLOW_TYPED_CUES: true,
        HMB_USE_VOICE_COACH: true,
        HMB_ENABLE_VOICE_CONTROL: false
      });
    }
  });

  // Open options page on first install
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    case 'GET_TAB_SWITCHES':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const windowId = tabs && tabs.length ? tabs[0].windowId : undefined;
        const stats = typeof getTabStats === 'function' ? getTabStats(windowId) : { counts: {}, ratePerMin: 0 };
        sendResponse({
          counts: stats.counts || { last10: 0, last30: 0, last60: getTabSwitchCount?.() || 0 },
          ratePerMin: stats.ratePerMin || 0
        });
      });
      return true;

    case 'RESET_TAB_SWITCHES':
      // Reset tab switch counter
      resetTabSwitchCount();
      sendResponse({ success: true });
      break;

    case 'GET_CONFIG':
      // Return current configuration
      chrome.storage.sync.get(null, (config) => {
        sendResponse(config);
      });
      return true; // Keep channel open for async

    case 'SAVE_CONFIG':
      // Save configuration
      chrome.storage.sync.set(payload, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'MUSICHERO_GENERATE':
      handleMusicHeroGenerate(payload || {}, sendResponse);
      return true;

    default:
      console.warn('[HMB:background] Unknown message type:', type);
      sendResponse({ error: 'Unknown message type' });
  }
});

// Keep service worker alive with periodic ping
const KEEP_ALIVE_INTERVAL = 20000; // 20 seconds

setInterval(() => {
  chrome.storage.local.get(['lastPing'], (result) => {
    chrome.storage.local.set({ lastPing: Date.now() });
  });
}, KEEP_ALIVE_INTERVAL);

// Cleanup on shutdown (session summary)
chrome.runtime.onSuspend.addListener(() => {
  console.log('[HMB:background] Service worker suspending');
  // Note: Limited time here, keep cleanup minimal
});
