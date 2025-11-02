/**
 * youtube.js - YouTube music backend (default, no auth required)
 * Plays curated ambient/focus music via hidden iframe
 * Brainwave-inspired mode mapping (not medical claims)
 */

// Curated YouTube video IDs for each mode
// These are long-form ambient/focus music tracks
const MUSIC_LIBRARY = {
  // Focus: Low-BPM, structured rhythm (Alpha/low-Beta friendly ~8-15Hz feel)
  focus: [
    'jfKfPfyJRdk', // Lofi hip hop radio
    '5qap5aO4i9A', // Lofi beats
    'lTRiuFIWV54'  // Calm piano
  ],

  // Refocus: Rhythmic re-engagement, soft percussive build
  refocus: [
    'DWcJFNfaw9c', // Lofi study beats
    '7NOSDKb0HlU', // Chillhop
    'bmVKaAV_7-A'  // Lofi focus
  ],

  // Calm: Ambient pads, minimal transients (Theta friendly ~4-8Hz feel)
  calm: [
    '1ZYbU82GVz4', // Ambient space
    'UfcAVejslrU', // Underwater ambient
    'kJnKt4cxf6M'  // Deep ambient
  ]
};

let currentPlayer = null;
let currentMode = null;
let isPlaying = false;

/**
 * Initialize YouTube adapter
 */
export async function init() {
  console.log('[HMB:youtube] YouTube adapter initialized');
}

/**
 * Play music for a specific mode
 */
export async function play(mode) {
  if (!MUSIC_LIBRARY[mode]) {
    console.warn('[HMB:youtube] Unknown mode:', mode);
    mode = 'calm';
  }

  // Pick a random video from the mode
  const videos = MUSIC_LIBRARY[mode];
  const videoId = videos[Math.floor(Math.random() * videos.length)];

  // If already playing same mode, don't restart
  if (currentMode === mode && isPlaying && currentPlayer) {
    console.log('[HMB:youtube] Already playing', mode);
    return;
  }

  currentMode = mode;
  await createPlayer(videoId);
  isPlaying = true;
}

/**
 * Stop playback
 */
export function stop() {
  if (currentPlayer) {
    currentPlayer.remove();
    currentPlayer = null;
  }
  isPlaying = false;
  currentMode = null;
}

/**
 * Pause playback
 */
export function pause() {
  // YouTube iframe API would be needed for precise control
  // For now, we stop
  isPlaying = false;
}

/**
 * Resume playback
 */
export function resume() {
  if (currentMode) {
    play(currentMode);
  }
}

/**
 * Get playback status
 */
export function getStatus() {
  return {
    isPlaying,
    mode: currentMode
  };
}

/**
 * Create hidden YouTube player iframe
 */
function createPlayer(videoId) {
  return new Promise((resolve) => {
    // Remove old player
    if (currentPlayer) {
      currentPlayer.remove();
    }

    // Create new hidden iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'hmb-youtube-player';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.allow = 'autoplay';

    // Autoplay with mute=0 (user must have interacted with page)
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&loop=1&playlist=${videoId}&controls=0`;

    document.body.appendChild(iframe);
    currentPlayer = iframe;

    // Wait a bit for iframe to load
    setTimeout(resolve, 500);
  });
}

export default {
  init,
  play,
  stop,
  pause,
  resume,
  getStatus
};
