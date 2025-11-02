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
  const toggleBtn = document.getElementById('toggle-music');
  const toggleIcon = document.getElementById('toggle-icon');
  const toggleText = document.getElementById('toggle-text');
  const settingsBtn = document.getElementById('settings-btn');
  const tabSwitchesEl = document.getElementById('tab-switches');
  const sessionTimeEl = document.getElementById('session-time');
  const modeRadios = document.querySelectorAll('input[name="mode"]');

  // State
  let isPlaying = false;
  let currentState = 'neutral';
  let sessionStart = Date.now();

  // Initialize
  init();

  async function init() {
    // Load current state from storage
    await loadState();

    // Update UI
    updateUI();

    // Set up event listeners
    toggleBtn.addEventListener('click', handleToggleMusic);
    settingsBtn.addEventListener('click', handleOpenSettings);

    modeRadios.forEach(radio => {
      radio.addEventListener('change', handleModeChange);
    });

    // Update stats periodically
    setInterval(updateStats, 1000);
  }

  async function loadState() {
    // Query active tab for state
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab) {
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
      }
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
    stateMessage.textContent = stateConfig.message;

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
        message: "You're in the zone! Keep going."
      },
      neutral: {
        icon: '😐',
        label: 'Neutral',
        message: 'Finding your rhythm.'
      },
      distracted: {
        icon: '😟',
        label: 'Distracted',
        message: 'Lots happening. Let\'s refocus gently.'
      },
      idle: {
        icon: '😴',
        label: 'Idle',
        message: 'Taking a break? That\'s wise.'
      }
    };

    return configs[state] || configs.neutral;
  }

  async function handleToggleMusic() {
    isPlaying = !isPlaying;

    // Send message to content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: isPlaying ? 'PLAY_MUSIC' : 'PAUSE_MUSIC'
        });
      } catch (err) {
        console.warn('[HMB:popup] Could not send message to content script:', err);
      }
    }

    updateUI();
  }

  function handleOpenSettings() {
    chrome.runtime.openOptionsPage();
  }

  async function handleModeChange(event) {
    const mode = event.target.value;
    console.log('[HMB:popup] Mode changed to:', mode);

    // Send message to content script to change mode
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'SET_MODE',
          payload: { mode }
        });
      } catch (err) {
        console.warn('[HMB:popup] Could not set mode:', err);
      }
    }
  }

  function updateStats() {
    // Update session time
    const elapsed = Math.floor((Date.now() - sessionStart) / 60000); // minutes
    sessionTimeEl.textContent = elapsed > 0 ? `${elapsed}m` : '0m';
  }

})();
