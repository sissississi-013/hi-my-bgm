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

  const allowPageText = document.getElementById('allow-page-text');
  const allowTypedText = document.getElementById('allow-typed-text');

  const useYouTube = document.getElementById('use-youtube');
  const useSpotify = document.getElementById('use-spotify');
  const spotifyConfig = document.getElementById('spotify-config');
  const spotifyClientId = document.getElementById('spotify-client-id');
  const spotifyRedirectUri = document.getElementById('spotify-redirect-uri');

  const useMusicHero = document.getElementById('use-musichero');
  const musicHeroConfig = document.getElementById('musichero-config');
  const musicHeroApiUrl = document.getElementById('musichero-api-url');
  const musicHeroApiKey = document.getElementById('musichero-api-key');
  const musicHeroInstrumental = document.getElementById('musichero-instrumental');
  const musicHeroDuration = document.getElementById('musichero-duration');
  const allowLyricHook = document.getElementById('allow-lyric-hook');

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

  const useVoiceCoach = document.getElementById('use-voice-coach');

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

    useMusicHero.addEventListener('change', () => {
      musicHeroConfig.classList.toggle('active', useMusicHero.checked);
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

      // Context permissions
      allowPageText.checked = result.HMB_ALLOW_PAGE_CONTEXT !== false;
      allowTypedText.checked = result.HMB_ALLOW_TYPED_CUES !== false;

      // Music
      useYouTube.checked = result.HMB_USE_YOUTUBE !== false;
      useSpotify.checked = result.HMB_USE_SPOTIFY || false;
      spotifyClientId.value = result.SPOTIFY_CLIENT_ID || '';
      spotifyRedirectUri.value = result.SPOTIFY_REDIRECT_URI || '';
      spotifyConfig.classList.remove('active');
      if (useSpotify.checked) {
        spotifyConfig.classList.add('active');
      }

      useMusicHero.checked = result.HMB_USE_MUSICHERO || false;
      musicHeroApiUrl.value = result.MUSICHERO_API_URL || '';
      musicHeroApiKey.value = result.MUSICHERO_API_KEY || '';
      musicHeroInstrumental.checked = result.MUSICHERO_INSTRUMENTAL_ONLY !== false;
      musicHeroDuration.value = result.MUSICHERO_DEFAULT_DURATION || 30;
      allowLyricHook.checked = result.HMB_ALLOW_LYRIC_HOOK !== false;
      musicHeroConfig.classList.remove('active');
      if (useMusicHero.checked) {
        musicHeroConfig.classList.add('active');
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
      covalConfig.classList.remove('active');
      if (useCoval.checked) {
        covalConfig.classList.add('active');
      }

      useVoiceCoach.checked = result.HMB_USE_VOICE_COACH !== false;

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

      // Context permissions
      HMB_ALLOW_PAGE_CONTEXT: allowPageText.checked,
      HMB_ALLOW_TYPED_CUES: allowTypedText.checked,

      // Music
      HMB_USE_YOUTUBE: useYouTube.checked,
      HMB_USE_SPOTIFY: useSpotify.checked,
      SPOTIFY_CLIENT_ID: spotifyClientId.value,
      SPOTIFY_REDIRECT_URI: spotifyRedirectUri.value,
      HMB_USE_MUSICHERO: useMusicHero.checked,
      MUSICHERO_API_URL: musicHeroApiUrl.value,
      MUSICHERO_API_KEY: musicHeroApiKey.value,
      MUSICHERO_INSTRUMENTAL_ONLY: musicHeroInstrumental.checked,
      MUSICHERO_DEFAULT_DURATION: parseInt(musicHeroDuration.value || '30', 10),
      HMB_ALLOW_LYRIC_HOOK: allowLyricHook.checked,

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
      HMB_USE_VOICE_COACH: useVoiceCoach.checked,

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
