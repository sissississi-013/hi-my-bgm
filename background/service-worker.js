/**
 * service-worker.js - Background service worker (MV3)
 * Handles tab activity tracking, message routing, and extension lifecycle
 */

// Import tab activity tracking
importScripts('tab-activity.js');

console.log('[HMB:background] Service worker initialized');

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
        HMB_USE_VOICE_COACH: true
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
      // Return current tab switch count
      sendResponse({ count: getTabSwitchCount() });
      break;

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
