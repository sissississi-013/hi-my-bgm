/**
 * sponsor.js - Feature flags and API key management for sponsor integrations
 * All integrations are opt-in and fail-graceful
 */

const DEFAULT_CONFIG = {
  // Captain AI - Agent orchestration
  HMB_USE_CAPTAIN: false,
  CAPTAIN_API_URL: 'https://api.runcaptain.com',
  CAPTAIN_API_KEY: '',

  // Metorial AI - User memory
  HMB_USE_METORIAL: false,
  METORIAL_API_URL: 'https://api.metorial.com',
  METORIAL_API_KEY: '',

  // Coval AI - Voice TTS
  HMB_USE_COVAL: false,
  COVAL_API_URL: 'https://api.coval.dev',
  COVAL_API_KEY: '',
  COVAL_VOICE_ID: 'default',

  // OpenAI - Optional LLM
  HMB_USE_OPENAI: false,
  OPENAI_API_KEY: '',

  // Anthropic - Optional LLM
  HMB_USE_ANTHROPIC: false,
  ANTHROPIC_API_KEY: '',

  // Spotify - Optional music backend
  HMB_USE_SPOTIFY: false,
  SPOTIFY_CLIENT_ID: '',
  SPOTIFY_REDIRECT_URI: '',

  // YouTube - Default music backend
  HMB_USE_YOUTUBE: true
};

let cachedConfig = null;

/**
 * Load configuration from chrome.storage.sync
 */
export async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(Object.keys(DEFAULT_CONFIG), (result) => {
      cachedConfig = { ...DEFAULT_CONFIG, ...result };
      resolve(cachedConfig);
    });
  });
}

/**
 * Save configuration to chrome.storage.sync
 */
export async function saveConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(config, () => {
      cachedConfig = { ...cachedConfig, ...config };
      resolve();
    });
  });
}

/**
 * Get a specific config value
 */
export async function get(key) {
  if (!cachedConfig) {
    await loadConfig();
  }
  return cachedConfig[key] ?? DEFAULT_CONFIG[key];
}

/**
 * Check if a feature is enabled
 */
export async function isEnabled(feature) {
  const value = await get(feature);
  return value === true || value === 'true';
}

/**
 * Get API key for a service
 */
export async function getKey(keyName) {
  const key = await get(keyName);
  return key && key.length > 0 ? key : null;
}

/**
 * Get config object synchronously (requires prior loadConfig call)
 */
export function getSync() {
  return cachedConfig || DEFAULT_CONFIG;
}

// Initialize on load
if (typeof chrome !== 'undefined' && chrome.storage) {
  loadConfig();
}

export default {
  loadConfig,
  saveConfig,
  get,
  isEnabled,
  getKey,
  getSync
};
