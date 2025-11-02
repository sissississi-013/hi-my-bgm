/**
 * metorial.js - Metorial AI client
 * Provides user memory, personalization, profiles, and session summaries
 * Documentation: https://metorial.com
 */

import * as Sponsor from '../lib/sponsor.js';

/**
 * Load user profile from Metorial
 * @param {string} userId - User identifier
 * @returns {Promise<Object>} Profile object with preferences and sensitivity settings
 */
export async function loadUserProfile(userId = 'default') {
  const config = await Sponsor.loadConfig();
  const enabled = config.HMB_USE_METORIAL;
  const apiKey = config.METORIAL_API_KEY;

  if (!enabled || !apiKey) {
    // Fallback to local storage
    return loadLocalProfile(userId);
  }

  const apiUrl = config.METORIAL_API_URL || 'https://api.metorial.com';

  try {
    // Metorial API endpoint - adjust based on actual API docs
    const response = await fetch(`${apiUrl}/v1/profiles/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('[HMB:metorial] Profile load failed, using local fallback');
      return loadLocalProfile(userId);
    }

    const data = await response.json();

    // Expected structure (adjust based on Metorial API):
    // {
    //   userId: string,
    //   preferredModes: string[],
    //   sensitivity: {
    //     idleTimeout: number,
    //     distractionThreshold: number
    //   },
    //   colorTheme: string
    // }

    return {
      userId: data.userId || userId,
      preferredModes: data.preferredModes || ['focus', 'calm'],
      sensitivity: {
        idleTimeout: data.sensitivity?.idleTimeout ?? 10,
        distractionThreshold: data.sensitivity?.distractionThreshold ?? 5
      },
      colorTheme: data.colorTheme || 'cool'
    };
  } catch (err) {
    console.error('[HMB:metorial] Load profile error:', err);
    return loadLocalProfile(userId);
  }
}

/**
 * Save session summary to Metorial
 * @param {Object} summary - Session summary from state.getSessionSummary()
 * @returns {Promise<boolean>} Success status
 */
export async function saveSessionSummary(summary) {
  const config = await Sponsor.loadConfig();
  const enabled = config.HMB_USE_METORIAL;
  const apiKey = config.METORIAL_API_KEY;

  if (!enabled || !apiKey) {
    // Save locally
    return saveLocalSummary(summary);
  }

  const apiUrl = config.METORIAL_API_URL || 'https://api.metorial.com';
  const userId = summary.userId || 'default';

  try {
    // Metorial API endpoint - adjust based on actual API docs
    const response = await fetch(`${apiUrl}/v1/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        startedAt: summary.startedAt,
        durationSec: summary.durationSec,
        stateHistogram: summary.stateHistogram,
        totalStates: summary.totalStates,
        timestamp: Date.now()
      })
    });

    if (!response.ok) {
      console.warn('[HMB:metorial] Session save failed, saving locally');
      return saveLocalSummary(summary);
    }

    console.log('[HMB:metorial] Session summary saved successfully');
    return true;
  } catch (err) {
    console.error('[HMB:metorial] Save session error:', err);
    return saveLocalSummary(summary);
  }
}

/**
 * Load profile from local storage (fallback)
 */
async function loadLocalProfile(userId) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['userProfile'], (result) => {
      const profile = result.userProfile || {
        userId,
        preferredModes: ['focus', 'calm'],
        sensitivity: {
          idleTimeout: 10,
          distractionThreshold: 5
        },
        colorTheme: 'cool'
      };
      resolve(profile);
    });
  });
}

/**
 * Save summary to local storage (fallback)
 */
async function saveLocalSummary(summary) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['sessionHistory'], (result) => {
      const history = result.sessionHistory || [];
      history.push({
        ...summary,
        timestamp: Date.now()
      });

      // Keep last 100 sessions
      if (history.length > 100) {
        history.shift();
      }

      chrome.storage.local.set({ sessionHistory: history }, () => {
        console.log('[HMB:metorial] Session saved locally');
        resolve(true);
      });
    });
  });
}

export default {
  loadUserProfile,
  saveSessionSummary
};
