/**
 * popup.js - Popup UI logic
 * Displays current state, controls, and mode selection
 */

(function() {
  'use strict';

  // DOM elements
  const stateIcon = document.getElementById('state-icon');
  const stateLabel = document.getElementById('state-label');
  const stateMessage = document.getElementById('state-message');
  const stateDetail = document.getElementById('state-detail');
  const toggleBtn = document.getElementById('toggle-music');
  const toggleIcon = document.getElementById('toggle-icon');
  const toggleText = document.getElementById('toggle-text');
  const settingsBtn = document.getElementById('settings-btn');
  const tabSwitchesEl = document.getElementById('tab-switches');
  const sessionTimeEl = document.getElementById('session-time');
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const voiceIndicator = document.getElementById('voice-indicator');
  const voiceStatus = document.getElementById('voice-status');

  // State
  let isPlaying = false;
  let currentState = 'neutral';
  let sessionStart = Date.now();
  let voiceControlEnabled = false;
  let stateCopyOverride = null;

  // Initialize
  init();

  async function init() {
    // Load current state from storage
    await loadState();
    await loadVoiceSetting();

    // Update UI
    updateUI();

    // Set up event listeners
    toggleBtn.addEventListener('click', handleToggleMusic);
    settingsBtn.addEventListener('click', handleOpenSettings);

    modeRadios.forEach(radio => {
      radio.addEventListener('change', handleModeChange);
    });

    chrome.storage.onChanged.addListener(handleStorageChange);

    // Update stats periodically
    setInterval(updateStats, 1000);
  }

  async function loadState() {
    stateCopyOverride = null;

    // Query active tab for state
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab) {
      // Check if content script can run on this tab
      if (!canRunOnTab(tab)) {
        console.log('[HMB:popup] Content script not available on this tab');
        stateCopyOverride = {
          subtitle: 'Unavailable on this page',
          detail: 'Not available on this page (chrome:// URLs restricted)'
        };
        return;
      }

      try {
        // Send message to content script to get state
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'GET_STATE'
        });

        if (response) {
          currentState = response.label || 'neutral';
          isPlaying = response.isPlaying || false;
        }
      } catch (err) {
        console.warn('[HMB:popup] Could not get state from content script:', err);
        // Content script might not be loaded yet
        stateCopyOverride = {
          subtitle: 'Loading companion…',
          detail: 'Refresh the page if the planet is missing.'
        };
      }
    } else {
      stateCopyOverride = {
        subtitle: 'No active tab',
        detail: 'Open a tab to sync with the companion.'
      };
    }

    // Get tab switches from background
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_TAB_SWITCHES'
      });
      if (response && typeof response.count === 'number') {
        tabSwitchesEl.textContent = response.count;
      }
    } catch (err) {
      console.warn('[HMB:popup] Could not get tab switches:', err);
    }
  }

  function updateUI() {
    // Update state display
    const stateConfig = getStateConfig(currentState);
    stateIcon.textContent = stateConfig.icon;
    stateLabel.textContent = stateConfig.label;
    if (stateCopyOverride) {
      setStateCopy(stateCopyOverride.subtitle, stateCopyOverride.detail);
    } else {
      setStateCopy(stateConfig.subtitle || stateConfig.message, stateConfig.message);
    }

    // Update toggle button
    if (isPlaying) {
      toggleIcon.textContent = '⏸️';
      toggleText.textContent = 'Pause';
      toggleBtn.classList.add('playing');
    } else {
      toggleIcon.textContent = '▶️';
      toggleText.textContent = 'Play';
      toggleBtn.classList.remove('playing');
    }
  }

  function getStateConfig(state) {
    const configs = {
      focused: {
        icon: '😄',
        label: 'Focused',
        subtitle: 'Locked in.',
        message: "You're in the zone! Keep going."
      },
      neutral: {
        icon: '😐',
        label: 'Neutral',
        subtitle: 'Finding your rhythm.',
        message: 'Ease into the task when you\'re ready.'
      },
      distracted: {
        icon: '😟',
        label: 'Distracted',
        subtitle: 'We noticed some tab hopping.',
        message: 'Lots happening. Let\'s refocus gently.'
      },
      idle: {
        icon: '😴',
        label: 'Idle',
        subtitle: 'Resting moment.',
        message: 'Taking a break? That\'s wise.'
      }
    };

    return configs[state] || configs.neutral;
  }

  function setStateCopy(subtitle, detail = subtitle) {
    if (stateMessage) {
      stateMessage.textContent = subtitle;
    }
    if (stateDetail) {
      stateDetail.textContent = detail;
    }
  }

  function loadVoiceSetting() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['HMB_ENABLE_VOICE_CONTROL'], (result) => {
        voiceControlEnabled = Boolean(result.HMB_ENABLE_VOICE_CONTROL);
        updateVoiceIndicator(voiceControlEnabled);
        resolve();
      });
    });
  }

  function updateVoiceIndicator(enabled) {
    if (!voiceIndicator || !voiceStatus) return;
    voiceIndicator.hidden = false;
    voiceIndicator.classList.toggle('stat--badge', enabled);
    voiceIndicator.classList.toggle('stat--muted', !enabled);
    voiceStatus.textContent = enabled ? 'On' : 'Off';
  }

  function handleStorageChange(changes, areaName) {
    if (areaName !== 'sync') return;
    if (Object.prototype.hasOwnProperty.call(changes, 'HMB_ENABLE_VOICE_CONTROL')) {
      voiceControlEnabled = Boolean(changes.HMB_ENABLE_VOICE_CONTROL.newValue);
      updateVoiceIndicator(voiceControlEnabled);
    }
  }

  async function handleToggleMusic() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    console.log('[HMB:popup] Toggle music clicked, tab:', tab);

    // Check if we can communicate with this tab
    if (!canRunOnTab(tab)) {
      const msg = tab && tab.url
        ? `Not available on ${new URL(tab.url).protocol} pages`
        : 'Not available on this page';
      stateCopyOverride = {
        subtitle: 'Unavailable on this page',
        detail: `Music controls not available. ${msg}`
      };
      setStateCopy(stateCopyOverride.subtitle, stateCopyOverride.detail);
      alert(`Music controls not available. ${msg}\n\nPlease open a regular website (http:// or https://)`);
      return;
    }

    isPlaying = !isPlaying;

    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: isPlaying ? 'PLAY_MUSIC' : 'PAUSE_MUSIC'
      });
      stateCopyOverride = null;
      updateUI();
    } catch (err) {
      console.error('[HMB:popup] Failed to send message:', err);
      // Revert state if failed
      isPlaying = !isPlaying;
      updateUI();

      // Show more helpful error message
      if (err.message && err.message.includes('Receiving end does not exist')) {
        stateCopyOverride = {
          subtitle: 'Bubble not loaded',
          detail: 'Please refresh the page (F5) and try again.'
        };
      } else {
        stateCopyOverride = {
          subtitle: 'Playback error',
          detail: err.message ? `Error: ${err.message}` : 'Please refresh the page'
        };
      }
      setStateCopy(stateCopyOverride.subtitle, stateCopyOverride.detail);
    }
  }

  function handleOpenSettings() {
    chrome.runtime.openOptionsPage();
  }

  async function handleModeChange(event) {
    const mode = event.target.value;
    console.log('[HMB:popup] Mode changed to:', mode);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if we can communicate with this tab
    if (!canRunOnTab(tab)) {
      const msg = tab && tab.url
        ? `Not available on ${new URL(tab.url).protocol} pages`
        : 'Not available on this page';
      stateCopyOverride = {
        subtitle: 'Unavailable on this page',
        detail: `Mode controls not available. ${msg}`
      };
      setStateCopy(stateCopyOverride.subtitle, stateCopyOverride.detail);
      alert(`Mode controls not available. ${msg}\n\nPlease open a regular website (http:// or https://)`);
      // Reset to auto
      document.querySelector('input[value="auto"]').checked = true;
      return;
    }

    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'SET_MODE',
        payload: { mode }
      });
      stateCopyOverride = null;
      updateUI();
    } catch (err) {
      console.error('[HMB:popup] Could not set mode:', err);
      if (err.message && err.message.includes('Receiving end does not exist')) {
        stateCopyOverride = {
          subtitle: 'Bubble not loaded',
          detail: 'Please refresh the page (F5) and try again.'
        };
      } else {
        stateCopyOverride = {
          subtitle: 'Mode error',
          detail: err.message ? `Error: ${err.message}` : 'Please refresh the page'
        };
      }
      setStateCopy(stateCopyOverride.subtitle, stateCopyOverride.detail);
    }
  }

  function updateStats() {
    // Update session time
    const elapsed = Math.floor((Date.now() - sessionStart) / 60000); // minutes
    sessionTimeEl.textContent = elapsed > 0 ? `${elapsed}m` : '0m';
  }

  /**
   * Check if content script can run on this tab
   * Content scripts are restricted on chrome://, chrome-extension://, and other special pages
   */
  function canRunOnTab(tab) {
    if (!tab) {
      console.log('[HMB:popup] No tab object');
      return false;
    }

    if (!tab.url) {
      console.log('[HMB:popup] Tab URL not available, assuming it\'s OK to try');
      // If we can't read the URL, assume it's a regular page and let the try/catch handle it
      return true;
    }

    const url = tab.url.toLowerCase();
    console.log('[HMB:popup] Checking URL:', url);

    // Restricted URL schemes
    const restrictedSchemes = [
      'chrome://',
      'chrome-extension://',
      'edge://',
      'about:',
      'file://', // Unless user enabled it in extension settings
      'view-source:',
      'data:',
      'javascript:'
    ];

    // Check if URL starts with any restricted scheme
    for (const scheme of restrictedSchemes) {
      if (url.startsWith(scheme)) {
        console.log('[HMB:popup] Blocked restricted scheme:', scheme);
        return false;
      }
    }

    // Chrome Web Store is also restricted
    if (url.includes('chrome.google.com/webstore')) {
      console.log('[HMB:popup] Blocked Chrome Web Store');
      return false;
    }

    console.log('[HMB:popup] URL is OK');
    return true;
  }

})();
