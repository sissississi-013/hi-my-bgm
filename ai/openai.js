/**
 * openai.js - OpenAI client (optional)
 * Generates supportive messages via GPT API
 */

import * as Sponsor from '../lib/sponsor.js';

/**
 * Generate a supportive message using OpenAI
 * @param {string} state - Current focus state
 * @returns {Promise<string>}
 */
export async function generateMessage(state) {
  const apiKey = await Sponsor.getKey('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const systemPrompt = `You are a friendly, concise focus companion for ADHD/neurodivergent users. Be gentle, supportive, and non-judgmental.`;

  const userPrompt = `Current state is "${state}". Write a one-line supportive message (max 12 words).`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 50,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    return text.trim();
  } catch (err) {
    console.error('[HMB:openai] Request failed:', err);
    throw err;
  }
}

export default {
  generateMessage
};
