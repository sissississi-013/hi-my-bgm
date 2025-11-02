/**
 * anthropic.js - Anthropic Claude client (optional)
 * Generates supportive messages via Claude API
 */

import * as Sponsor from '../lib/sponsor.js';

/**
 * Generate a supportive message using Claude
 * @param {string} state - Current focus state
 * @returns {Promise<string>}
 */
export async function generateMessage(state) {
  const apiKey = await Sponsor.getKey('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const systemPrompt = `You are a friendly, concise focus companion for ADHD/neurodivergent users. Be gentle, supportive, and non-judgmental.`;

  const userPrompt = `Current state is "${state}". Write a one-line supportive message (max 12 words).`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 50,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    return text.trim();
  } catch (err) {
    console.error('[HMB:anthropic] Request failed:', err);
    throw err;
  }
}

export default {
  generateMessage
};
