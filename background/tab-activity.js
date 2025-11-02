/**
 * tab-activity.js - Tab switching detection
 * Tracks tab activations and sends events to content scripts
 */

let tabSwitchCount = 0;
let lastResetTime = Date.now();

// Reset counter every 10 seconds
const RESET_INTERVAL = 10000;

// Listen for tab activations
chrome.tabs.onActivated.addListener((activeInfo) => {
  const now = Date.now();

  // Auto-reset counter if past interval
  if (now - lastResetTime > RESET_INTERVAL) {
    tabSwitchCount = 0;
    lastResetTime = now;
  }

  tabSwitchCount++;

  console.log('[HMB:tab-activity] Tab switched, count:', tabSwitchCount);

  // Notify content scripts on the active tab
  chrome.tabs.sendMessage(activeInfo.tabId, {
    type: 'TAB_SWITCHED',
    payload: {
      count: tabSwitchCount,
      timestamp: now
    }
  }).catch((err) => {
    // Content script might not be loaded yet, ignore
  });
});

// Also track when tabs are updated (page navigations)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    // Inject content script if needed (for dynamic pages)
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/overlay.js']
    }).catch((err) => {
      // Already injected or permission denied, ignore
    });
  }
});

/**
 * Get current tab switch count
 */
function getTabSwitchCount() {
  const now = Date.now();
  if (now - lastResetTime > RESET_INTERVAL) {
    tabSwitchCount = 0;
    lastResetTime = now;
  }
  return tabSwitchCount;
}

/**
 * Reset tab switch counter
 */
function resetTabSwitchCount() {
  tabSwitchCount = 0;
  lastResetTime = Date.now();
}

// Make functions available to service worker
if (typeof self !== 'undefined') {
  self.getTabSwitchCount = getTabSwitchCount;
  self.resetTabSwitchCount = resetTabSwitchCount;
}
