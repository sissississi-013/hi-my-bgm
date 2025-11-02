/**
 * act.js - Action dispatcher
 * Applies state changes to music and UI
 */

import * as State from './state.js';

/**
 * Apply the inferred state label
 * @param {string} newLabel - The new state label
 * @param {Object} musicAdapter - The music adapter instance
 * @param {Object} voiceAdapter - The voice adapter instance (optional)
 * @param {string} message - Supportive message to speak (optional)
 */
export async function apply(newLabel, musicAdapter, voiceAdapter = null, message = null) {
  const currentState = State.get();
  const changed = currentState.label !== newLabel;

  // Update state
  State.updateLabel(newLabel);

  if (!changed && currentState.isPlaying) {
    // No change and already playing
    return;
  }

  // Determine mode from label
  const mode = labelToMode(newLabel);

  // Play music
  try {
    await musicAdapter.play(mode);
    State.setPlaying(true, mode);
  } catch (err) {
    console.warn('[HMB:act] Music play failed:', err);
    State.setPlaying(false);
  }

  // Speak message if state changed
  if (changed && voiceAdapter && message) {
    try {
      await voiceAdapter.speak(message);
    } catch (err) {
      console.warn('[HMB:act] Voice speak failed:', err);
    }
  }
}

/**
 * Stop music playback
 */
export function stop(musicAdapter) {
  musicAdapter.stop();
  State.setPlaying(false, null);
}

/**
 * Map label to music mode
 */
function labelToMode(label) {
  switch (label) {
    case 'focused':
      return 'focus';
    case 'distracted':
      return 'refocus';
    case 'idle':
    case 'neutral':
    default:
      return 'calm';
  }
}

export default {
  apply,
  stop
};
