/**
 * captain.js - Captain AI client wrapper
 * Captain AI provides agent orchestration and workflow management
 * Documentation: https://docs.runcaptain.com/
 */

import * as Sponsor from '../lib/sponsor.js';

/**
 * Run reasoning through Captain AI
 * @param {Object} payload - { state, rawSignals, profile }
 * @returns {Promise<{ text: string, overrideState?: string }>}
 */
export async function runReasoning(payload) {
  const config = await Sponsor.loadConfig();
  const apiUrl = config.CAPTAIN_API_URL || 'https://api.runcaptain.com';
  const apiKey = config.CAPTAIN_API_KEY;

  if (!apiKey) {
    throw new Error('Captain API key not configured');
  }

  const { state, rawSignals = {}, profile = {} } = payload;

  // Build prompt for Captain
  const systemPrompt = `You are a friendly, concise focus companion for ADHD/neurodivergent users. Be gentle, supportive, and non-judgmental.`;

  const userPrompt = `Current focus state: "${state}"
Recent activity: ${JSON.stringify(rawSignals, null, 2)}

Write a supportive one-line message (max 12 words) that acknowledges their state without pressure or judgment.`;

  try {
    // Captain AI run endpoint - see https://docs.runcaptain.com/
    // Note: Adjust endpoint path based on actual Captain API documentation
    const response = await fetch(`${apiUrl}/v1/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Captain-specific payload structure
        // Adjust based on actual API schema
        agent: 'reasoning',
        prompt: userPrompt,
        system: systemPrompt,
        temperature: 0.7,
        max_tokens: 50
      })
    });

    if (!response.ok) {
      throw new Error(`Captain API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract text from Captain response
    // Adjust based on actual response format
    const text = data.result || data.text || data.output || '';

    return {
      text: text.trim(),
      overrideState: null // Captain could suggest state refinement
    };
  } catch (err) {
    console.error('[HMB:captain] Request failed:', err);
    throw err;
  }
}

/**
 * Run a tool call through Captain (future use)
 * @param {string} name - Tool name
 * @param {Object} args - Tool arguments
 */
export async function runTool(name, args) {
  const config = await Sponsor.loadConfig();
  const apiUrl = config.CAPTAIN_API_URL || 'https://api.runcaptain.com';
  const apiKey = config.CAPTAIN_API_KEY;

  if (!apiKey) {
    throw new Error('Captain API key not configured');
  }

  // TODO: Implement tool routing through Captain
  // See https://docs.runcaptain.com/ for tool call patterns

  console.log('[HMB:captain] Tool call stub:', name, args);
  return { success: false, message: 'Tool routing not implemented' };
}

export default {
  runReasoning,
  runTool
};
