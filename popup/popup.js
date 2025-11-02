/**
 * popup.js - Popup UI logic (live companion)
 */

(function() {
  'use strict';

  const stateIcon = document.getElementById('state-icon');
  const stateLabel = document.getElementById('state-label');
  const stateMessage = document.getElementById('state-message');
  const toggleBtn = document.getElementById('toggle-music');
  const toggleIcon = document.getElementById('toggle-icon');
  const toggleText = document.getElementById('toggle-text');
  const settingsBtn = document.getElementById('settings-btn');
  const tabSwitchesEl = document.getElementById('tab-switches');
  const tabRateEl = document.getElementById('tab-rate');
  const sessionTimeEl = document.getElementById('session-time');
  const voiceStatusEl = document.getElementById('voice-status');
  const voiceStatusRow = document.getElementById('voice-status-row');
  const modeRadios = document.querySelectorAll('input[name="mode"]');

  let isPlaying = false;
  let currentState = 'neutral';
  let sessionStart = Date.now();
  let voiceState = { enabled: false, listening: false, supported: false };
  let lastTabStats = { last10: 0, last60: 0, ratePerMin: 0 };

  init();

  async function init() {
    await loadState();
    updateUI();
    updateStats();

    toggleBtn.addEventListener('click', handleToggleMusic);
    settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

    modeRadios.forEach((radio) => {
      radio.addEventListener('change', handleModeChange);
    });

    setInterval(() => {
      updateStats();
    }, 1000);
  }

  async function loadState() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab) {
      if (!canRunOnTab(tab)) {
        stateMessage.textContent = 'Not available on this page (chrome:// and system pages are restricted).';
        return;
      }

      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATE' });
        if (response) {
          currentState = response.label || 'neutral';
          isPlaying = response.isPlaying || false;
          if (isPlaying) {
            sessionStart = Date.now();
          }
          if (response.voice) {
            voiceState = {
              enabled: Boolean(response.voice.enabled),
              listening: Boolean(response.voice.listening),
              supported: response.voice.supported !== false
            };
          }
        }
      } catch (err) {
        console.warn('[HMB:popup] Could not get state from content script:', err);
        stateMessage.textContent = 'Bubble not active yet. Refresh the page if needed.';
      }
    }

    try {
      const statsResponse = await chrome.runtime.sendMessage({ type: 'GET_TAB_SWITCHES' });
      if (statsResponse) {
        const counts = statsResponse.counts || { last10: 0, last60: 0 };
        lastTabStats = {
          last10: counts.last10 || 0,
          last60: counts.last60 || 0,
          ratePerMin: statsResponse.ratePerMin || 0
        };
      }
    } catch (err) {
      console.warn('[HMB:popup] Could not get tab switches:', err);
    }
  }

  function updateUI() {
    const config = getStateConfig(currentState);
    stateIcon.textContent = config.icon;
    stateLabel.textContent = config.label;
    stateMessage.textContent = config.message;

    if (isPlaying) {
      toggleBtn.classList.remove('paused');
      toggleIcon.textContent = '⏸️';
      toggleText.textContent = 'Pause music';
    } else {
      toggleBtn.classList.add('paused');
      toggleIcon.textContent = '▶️';
      toggleText.textContent = 'Play music';
    }

    updateVoiceStatus();
    updateTabStats();
  }

  function updateStats() {
    const elapsed = Math.max(0, Date.now() - sessionStart);
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    sessionTimeEl.textContent = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  function updateTabStats() {
    tabSwitchesEl.textContent = `${lastTabStats.last10} / 10s • ${lastTabStats.last60} / 60s`;
    tabRateEl.textContent = Number(lastTabStats.ratePerMin || 0).toFixed(1);
  }

  function updateVoiceStatus() {
    if (!voiceStatusRow) return;
    if (!voiceState.supported) {
      voiceStatusRow.style.display = 'none';
      return;
    }
    voiceStatusRow.style.display = '';
    if (!voiceState.enabled) {
      voiceStatusEl.textContent = 'Off';
      voiceStatusEl.className = 'stat__value';
      return;
    }
    voiceStatusEl.textContent = voiceState.listening ? 'Listening…' : 'Standby';
    voiceStatusEl.className = `stat__value ${voiceState.listening ? 'active' : ''}`;
  }

  function getStateConfig(state) {
    const configs = {
      focused: {
        icon: '😄',
        label: 'Focused',
        message: "Flow locked in. Keep going!"
      },
      neutral: {
        icon: '😐',
        label: 'Neutral',
        message: 'Finding your rhythm.'
      },
      distracted: {
        icon: '😟',
        label: 'Refocus',
        message: 'Lots happening. Choose one tab to lean into.'
      },
      idle: {
        icon: '😴',
        label: 'Idle',
        message: 'Taking a breather. Ready when you are.'
      }
    };

    return configs[state] || configs.neutral;
  }

  async function handleToggleMusic() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!canRunOnTab(tab)) {
      alert('Controls unavailable on this page. Try a regular https:// tab.');
      return;
    }

    const shouldPlay = !isPlaying;
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: shouldPlay ? 'PLAY_MUSIC' : 'PAUSE_MUSIC'
      });
      if (response && response.success !== false) {
        isPlaying = shouldPlay;
        if (shouldPlay) {
          sessionStart = Date.now();
        }
        updateUI();
      }
    } catch (err) {
      console.error('[HMB:popup] Toggle failed:', err);
    }
  }

  async function handleModeChange(event) {
    const mode = event.target.value;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!canRunOnTab(tab)) {
      alert('Mode controls unavailable on this page.');
      document.querySelector('input[value="auto"]').checked = true;
      return;
    }

    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'SET_MODE',
        payload: { mode }
      });
      if (mode !== 'auto') {
        isPlaying = true;
      }
      updateUI();
    } catch (err) {
      console.error('[HMB:popup] Mode change failed:', err);
    }
  }

  function canRunOnTab(tab) {
    if (!tab || !tab.url) return false;
    const url = new URL(tab.url);
    return url.protocol === 'http:' || url.protocol === 'https:';
  }
})();
