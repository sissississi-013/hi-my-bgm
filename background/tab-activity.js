/**
 * tab-activity.js - Tab switching detection
 * Tracks tab activations and sends events to content scripts
 */

const HISTORY_WINDOW_MS = 60000;
const MID_WINDOW_MS = 30000;
const SHORT_WINDOW_MS = 10000;
const BURST_THRESHOLD = 5;
const SHORT_BURST_THRESHOLD = 3;

let switchHistory = [];

chrome.tabs.onActivated.addListener((activeInfo) => {
  const now = Date.now();
  prune(now);

  switchHistory.push({
    time: now,
    windowId: activeInfo.windowId,
    tabId: activeInfo.tabId
  });

  const stats = computeStats(activeInfo.windowId, now);

  sendMessage(activeInfo.tabId, 'TAB_ACTIVITY', {
    counts: stats.counts,
    ratePerMin: stats.ratePerMin,
    windowId: activeInfo.windowId,
    timestamp: now
  });

  // Maintain backward compatibility for listeners expecting TAB_SWITCHED
  sendMessage(activeInfo.tabId, 'TAB_SWITCHED', {
    count: stats.counts.last60,
    counts: stats.counts,
    timestamp: now
  });

  if (stats.counts.last60 >= BURST_THRESHOLD || stats.counts.last10 >= SHORT_BURST_THRESHOLD) {
    sendMessage(activeInfo.tabId, 'TAB_BURST', {
      countLast60s: stats.counts.last60,
      countLast10s: stats.counts.last10,
      ratePerMin: stats.ratePerMin,
      timestamp: now
    });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/overlay.js']
    }, () => chrome.runtime.lastError); // ignore errors
  }
});

function sendMessage(tabId, type, payload) {
  if (!tabId) return;
  try {
    chrome.tabs.sendMessage(tabId, { type, payload }, () => chrome.runtime.lastError);
  } catch (err) {
    // Ignore tabs without the content script
  }
}

function computeStats(windowId, now = Date.now()) {
  prune(now);

  const entries = switchHistory.filter((entry) => entry.windowId === windowId);

  const counts = {
    last10: entries.filter((entry) => now - entry.time <= SHORT_WINDOW_MS).length,
    last30: entries.filter((entry) => now - entry.time <= MID_WINDOW_MS).length,
    last60: entries.filter((entry) => now - entry.time <= HISTORY_WINDOW_MS).length
  };

  const firstInWindow = entries.find((entry) => now - entry.time <= HISTORY_WINDOW_MS);
  const spanMs = firstInWindow ? Math.max(now - firstInWindow.time, 1) : HISTORY_WINDOW_MS;
  const ratePerMin = counts.last60 === 0 ? 0 : Number(((counts.last60 * 60000) / Math.min(spanMs, HISTORY_WINDOW_MS)).toFixed(1));

  return { counts, ratePerMin };
}

function prune(now) {
  const cutoff = now - HISTORY_WINDOW_MS;
  switchHistory = switchHistory.filter((entry) => entry.time >= cutoff);
}

function getTabSwitchCount() {
  prune(Date.now());
  return switchHistory.length;
}

function resetTabSwitchCount() {
  switchHistory = [];
}

if (typeof self !== 'undefined') {
  self.getTabSwitchCount = getTabSwitchCount;
  self.resetTabSwitchCount = resetTabSwitchCount;
}
