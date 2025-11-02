/**
 * coval.js - Coval AI TTS/voice integration
 * Provides text-to-speech with fallback to Web Speech API
 * Documentation: https://www.coval.dev/
 */

import * as Sponsor from '../lib/sponsor.js';

let audioContext = null;
let isSpeaking = false;

/**
 * Initialize audio context
 */
function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Speak text using Coval TTS or Web Speech API fallback
 * @param {string} text - Text to speak
 * @param {string} voiceId - Optional voice ID for Coval
 * @returns {Promise<void>}
 */
export async function speak(text, voiceId = null) {
  if (isSpeaking) {
    console.log('[HMB:voice] Already speaking, skipping');
    return;
  }

  if (!text || text.trim().length === 0) {
    return;
  }

  const config = await Sponsor.loadConfig();
  const enabled = config.HMB_USE_COVAL;
  const apiKey = config.COVAL_API_KEY;

  // Try Coval if enabled
  if (enabled && apiKey) {
    try {
      await speakCoval(text, voiceId, config);
      return;
    } catch (err) {
      console.warn('[HMB:voice] Coval TTS failed, falling back to Web Speech:', err.message);
    }
  }

  // Fallback to Web Speech API
  await speakWebSpeech(text);
}

/**
 * Speak using Coval AI TTS
 */
async function speakCoval(text, voiceId, config) {
  const apiUrl = config.COVAL_API_URL || 'https://api.coval.dev';
  const apiKey = config.COVAL_API_KEY;
  const voice = voiceId || config.COVAL_VOICE_ID || 'default';

  isSpeaking = true;

  try {
    // Coval TTS endpoint - adjust based on actual API documentation
    // See: https://www.coval.dev/
    const response = await fetch(`${apiUrl}/v1/tts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        voice_id: voice,
        // Additional parameters as needed
        speed: 1.0,
        pitch: 1.0
      })
    });

    if (!response.ok) {
      throw new Error(`Coval API error: ${response.status}`);
    }

    // Assume response is audio data (e.g., MP3, WAV)
    const audioBlob = await response.blob();
    await playAudioBlob(audioBlob);

    console.log('[HMB:voice] Coval TTS completed');
  } catch (err) {
    console.error('[HMB:voice] Coval error:', err);
    throw err;
  } finally {
    isSpeaking = false;
  }
}

/**
 * Play audio blob via Web Audio API
 */
async function playAudioBlob(blob) {
  const ctx = initAudio();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);

  return new Promise((resolve) => {
    source.onended = resolve;
    source.start(0);
  });
}

/**
 * Speak using Web Speech API (fallback)
 */
async function speakWebSpeech(text) {
  if (!('speechSynthesis' in window)) {
    console.warn('[HMB:voice] Web Speech API not available');
    return;
  }

  isSpeaking = true;

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    utterance.onend = () => {
      isSpeaking = false;
      resolve();
    };

    utterance.onerror = (err) => {
      console.error('[HMB:voice] Web Speech error:', err);
      isSpeaking = false;
      resolve();
    };

    window.speechSynthesis.speak(utterance);
    console.log('[HMB:voice] Web Speech API speaking:', text);
  });
}

/**
 * Stop any ongoing speech
 */
export function stop() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  isSpeaking = false;
}

/**
 * Check if currently speaking
 */
export function isBusy() {
  return isSpeaking;
}

export default {
  speak,
  stop,
  isBusy
};
