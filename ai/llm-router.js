/**
 * llm-router.js - Routes LLM requests to appropriate backend
 * Priority: Captain AI > Anthropic > OpenAI > Local fallback
 */

import * as Sponsor from '../lib/sponsor.js';
import * as Captain from './captain.js';
import * as Anthropic from './anthropic.js';
import * as OpenAI from './openai.js';

/**
 * Generate a supportive one-liner message for the current state
 * @param {string} state - Current focus state
 * @param {Object} rawSignals - Raw behavioral signals
 * @param {Object} profile - User profile (optional)
 * @returns {Promise<string>} Supportive message
 */
export async function generateMessage(state, rawSignals = {}, profile = {}) {
  const config = await Sponsor.loadConfig();

  // Try Captain AI first (agent orchestration)
  if (config.HMB_USE_CAPTAIN && config.CAPTAIN_API_KEY) {
    try {
      const result = await Captain.runReasoning({
        state,
        rawSignals,
        profile
      });
      return result.text || getFallbackMessage(state);
    } catch (err) {
      console.warn('[HMB:llm-router] Captain failed, falling back:', err.message);
    }
  }

  // Try Anthropic Claude
  if (config.HMB_USE_ANTHROPIC && config.ANTHROPIC_API_KEY) {
    try {
      return await Anthropic.generateMessage(state);
    } catch (err) {
      console.warn('[HMB:llm-router] Anthropic failed, falling back:', err.message);
    }
  }

  // Try OpenAI
  if (config.HMB_USE_OPENAI && config.OPENAI_API_KEY) {
    try {
      return await OpenAI.generateMessage(state);
    } catch (err) {
      console.warn('[HMB:llm-router] OpenAI failed, falling back:', err.message);
    }
  }

  // Local fallback
  return getFallbackMessage(state);
}

/**
 * Local fallback messages (gentle, non-judgmental)
 */
function getFallbackMessage(state) {
  const messages = {
    focused: [
      "You're in the zone! Keep going.",
      "Great focus. You've got this.",
      "Flowing nicely. Stay with it.",
      "Deep work mode activated.",
      "Momentum is building beautifully."
    ],
    neutral: [
      "Taking it steady. All good.",
      "Finding your rhythm.",
      "No rush, you're doing fine.",
      "Ease into it at your pace.",
      "Gentle progress is still progress."
    ],
    distracted: [
      "Lots happening. Let's refocus gently.",
      "It's okay. One thing at a time.",
      "Breathe. You can return to center.",
      "Refocusing is always available.",
      "No judgment. Let's ease back in."
    ],
    idle: [
      "Taking a break? That's wise.",
      "Rest is part of the process.",
      "Recharging. Come back when ready.",
      "Pausing mindfully is productive.",
      "Stillness has its own value."
    ]
  };

  const pool = messages[state] || messages.neutral;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default {
  generateMessage,
  getFallbackMessage
};
