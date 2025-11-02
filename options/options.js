/**
 * options.js - Options page logic
 * Settings management and persistence
 */

(function() {
  'use strict';

  // DOM elements
  const idleTimeout = document.getElementById('idle-timeout');
  const idleValue = document.getElementById('idle-value');
  const distractionThreshold = document.getElementById('distraction-threshold');
  const distractionValue = document.getElementById('distraction-value');

  const bubblePosition = document.getElementById('bubble-position');
  const colorTheme = document.getElementById('color-theme');

  const useYouTube = document.getElementById('use-youtube');
  const useSpotify = document.getElementById('use-spotify');
  const spotifyConfig = document.getElementById('spotify-config');
  const spotifyClientId = document.getElementById('spotify-client-id');
  const spotifyRedirectUri = document.getElementById('spotify-redirect-uri');

  const useCaptain = document.getElementById('use-captain');
  const captainConfig = document.getElementById('captain-config');
  const captainApiUrl = document.getElementById('captain-api-url');
  const captainApiKey = document.getElementById('captain-api-key');

  const useMetorial = document.getElementById('use-metorial');
  const metorialConfig = document.getElementById('metorial-config');
  const metorialApiUrl = document.getElementById('metorial-api-url');
  const metorialApiKey = document.getElementById('metorial-api-key');

  const useCoval = document.getElementById('use-coval');
  const covalConfig = document.getElementById('coval-config');
  const covalApiUrl = document.getElementById('coval-api-url');
  const covalApiKey = document.getElementById('coval-api-key');
  const covalVoiceId = document.getElementById('coval-voice-id');

  const useOpenAI = document.getElementById('use-openai');
  const openaiConfig = document.getElementById('openai-config');
  const openaiApiKey = document.getElementById('openai-api-key');

  const useAnthropic = document.getElementById('use-anthropic');
  const anthropicConfig = document.getElementById('anthropic-config');
  const anthropicApiKey = document.getElementById('anthropic-api-key');

  const saveBtn = document.getElementById('save-btn');
  const resetBtn = document.getElementById('reset-btn');
  const statusMessage = document.getElementById('status-message');

  // Initialize
  init();

  function init() {
    // Load saved settings
    loadSettings();

    // Set up event listeners
    idleTimeout.addEventListener('input', () => {
      idleValue.textContent = idleTimeout.value;
    });

    distractionThreshold.addEventListener('input', () => {
      distractionValue.textContent = distractionThreshold.value;
    });

    // Toggle nested inputs visibility
    useSpotify.addEventListener('change', () => {
      spotifyConfig.classList.toggle('active', useSpotify.checked);
    });

    useCaptain.addEventListener('change', () => {
      captainConfig.classList.toggle('active', useCaptain.checked);
    });

    useMetorial.addEventListener('change', () => {
      metorialConfig.classList.toggle('active', useMetorial.checked);
    });

    useCoval.addEventListener('change', () => {
      covalConfig.classList.toggle('active', useCoval.checked);
    });

    useOpenAI.addEventListener('change', () => {
      openaiConfig.classList.toggle('active', useOpenAI.checked);
    });

    useAnthropic.addEventListener('change', () => {
      anthropicConfig.classList.toggle('active', useAnthropic.checked);
    });

    // Actions
    saveBtn.addEventListener('click', saveSettings);
    resetBtn.addEventListener('click', resetSettings);
  }

  function loadSettings() {
    chrome.storage.sync.get(null, (result) => {
      // Behavior
      idleTimeout.value = result.idleTimeout || 10;
      idleValue.textContent = idleTimeout.value;
      distractionThreshold.value = result.distractionThreshold || 5;
      distractionValue.textContent = distractionThreshold.value;

      // UI
      bubblePosition.value = result.bubblePosition || 'bottom-right';
      colorTheme.value = result.colorTheme || 'cool';

      // Music
      useYouTube.checked = result.HMB_USE_YOUTUBE !== false;
      useSpotify.checked = result.HMB_USE_SPOTIFY || false;
      spotifyClientId.value = result.SPOTIFY_CLIENT_ID || '';
      spotifyRedirectUri.value = result.SPOTIFY_REDIRECT_URI || '';
      if (useSpotify.checked) {
        spotifyConfig.classList.add('active');
      }

      // Captain AI
      useCaptain.checked = result.HMB_USE_CAPTAIN || false;
      captainApiUrl.value = result.CAPTAIN_API_URL || 'https://api.runcaptain.com';
      captainApiKey.value = result.CAPTAIN_API_KEY || '';
      if (useCaptain.checked) {
        captainConfig.classList.add('active');
      }

      // Metorial AI
      useMetorial.checked = result.HMB_USE_METORIAL || false;
      metorialApiUrl.value = result.METORIAL_API_URL || 'https://api.metorial.com';
      metorialApiKey.value = result.METORIAL_API_KEY || '';
      if (useMetorial.checked) {
        metorialConfig.classList.add('active');
      }

      // Coval AI
      useCoval.checked = result.HMB_USE_COVAL || false;
      covalApiUrl.value = result.COVAL_API_URL || 'https://api.coval.dev';
      covalApiKey.value = result.COVAL_API_KEY || '';
      covalVoiceId.value = result.COVAL_VOICE_ID || '';
      if (useCoval.checked) {
        covalConfig.classList.add('active');
      }

      // OpenAI
      useOpenAI.checked = result.HMB_USE_OPENAI || false;
      openaiApiKey.value = result.OPENAI_API_KEY || '';
      if (useOpenAI.checked) {
        openaiConfig.classList.add('active');
      }

      // Anthropic
      useAnthropic.checked = result.HMB_USE_ANTHROPIC || false;
      anthropicApiKey.value = result.ANTHROPIC_API_KEY || '';
      if (useAnthropic.checked) {
        anthropicConfig.classList.add('active');
      }
    });
  }

  function saveSettings() {
    const settings = {
      // Behavior
      idleTimeout: parseInt(idleTimeout.value, 10),
      distractionThreshold: parseInt(distractionThreshold.value, 10),

      // UI
      bubblePosition: bubblePosition.value,
      colorTheme: colorTheme.value,

      // Music
      HMB_USE_YOUTUBE: useYouTube.checked,
      HMB_USE_SPOTIFY: useSpotify.checked,
      SPOTIFY_CLIENT_ID: spotifyClientId.value,
      SPOTIFY_REDIRECT_URI: spotifyRedirectUri.value,

      // Captain AI
      HMB_USE_CAPTAIN: useCaptain.checked,
      CAPTAIN_API_URL: captainApiUrl.value,
      CAPTAIN_API_KEY: captainApiKey.value,

      // Metorial AI
      HMB_USE_METORIAL: useMetorial.checked,
      METORIAL_API_URL: metorialApiUrl.value,
      METORIAL_API_KEY: metorialApiKey.value,

      // Coval AI
      HMB_USE_COVAL: useCoval.checked,
      COVAL_API_URL: covalApiUrl.value,
      COVAL_API_KEY: covalApiKey.value,
      COVAL_VOICE_ID: covalVoiceId.value,

      // OpenAI
      HMB_USE_OPENAI: useOpenAI.checked,
      OPENAI_API_KEY: openaiApiKey.value,

      // Anthropic
      HMB_USE_ANTHROPIC: useAnthropic.checked,
      ANTHROPIC_API_KEY: anthropicApiKey.value
    };

    chrome.storage.sync.set(settings, () => {
      showStatus('Settings saved successfully!', 'success');
    });
  }

  function resetSettings() {
    if (!confirm('Reset all settings to defaults? This cannot be undone.')) {
      return;
    }

    chrome.storage.sync.clear(() => {
      loadSettings();
      showStatus('Settings reset to defaults', 'success');
    });
  }

  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;

    setTimeout(() => {
      statusMessage.className = 'status-message';
    }, 3000);
  }

})();
