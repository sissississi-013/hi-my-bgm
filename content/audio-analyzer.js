/**
 * audio-analyzer.js - Audio reactivity for planet bubble
 * Analyzes music playback and generates beat envelope
 */

export class AudioAnalyzer {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.source = null;
    this.beat = 0;
    this.smoothedBeat = 0;
    this.isActive = false;
    this.isSpeaking = false; // TTS active flag
  }

  init() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      console.log('[AudioAnalyzer] Initialized');
      return true;
    } catch (err) {
      console.warn('[AudioAnalyzer] Failed to initialize:', err);
      return false;
    }
  }

  /**
   * Connect to an audio element (YouTube iframe, audio tag, etc.)
   */
  connectToElement(element) {
    if (!this.audioContext || !this.analyser) {
      if (!this.init()) return false;
    }

    try {
      // Disconnect previous source
      if (this.source) {
        this.source.disconnect();
      }

      // Create media element source
      this.source = this.audioContext.createMediaElementSource(element);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      this.isActive = true;
      console.log('[AudioAnalyzer] Connected to audio element');
      return true;
    } catch (err) {
      // Might fail if element already has source
      console.warn('[AudioAnalyzer] Could not connect:', err);
      return false;
    }
  }

  /**
   * Attempt to connect to YouTube iframe audio
   * Note: This is tricky due to cross-origin restrictions
   */
  async connectToYouTube(iframeElement) {
    // Unfortunately, we can't directly access YouTube iframe audio due to CORS
    // Instead, we'll simulate beat detection based on visual indicators or timers
    console.log('[AudioAnalyzer] YouTube direct audio access not possible (CORS)');
    console.log('[AudioAnalyzer] Using simulated beat detection');

    this.isActive = true;
    this.startSimulatedBeat();
    return false;
  }

  /**
   * Start simulated beat for when we can't access audio directly
   */
  startSimulatedBeat() {
    // Simulate a beat at ~120 BPM (common music tempo)
    const bpm = 120;
    const interval = (60 / bpm) * 1000; // ms per beat

    setInterval(() => {
      if (this.isActive && !this.isSpeaking) {
        // Pulse beat value
        this.beat = 1.0;
        setTimeout(() => {
          this.beat = 0.0;
        }, 100); // Quick decay
      }
    }, interval);
  }

  /**
   * Analyze current audio and return beat envelope
   */
  analyze() {
    if (!this.isActive || !this.analyser || this.isSpeaking) {
      // Duck beat during speech
      this.smoothedBeat *= 0.9; // Decay
      return this.smoothedBeat;
    }

    // Get frequency data
    this.analyser.getByteFrequencyData(this.dataArray);

    // Calculate RMS (root mean square) energy
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }
    const rms = Math.sqrt(sum / this.dataArray.length);

    // Normalize to 0-1
    this.beat = Math.min(1.0, rms / 128);

    // Smooth the beat value
    const smoothing = 0.7;
    this.smoothedBeat = this.smoothedBeat * smoothing + this.beat * (1 - smoothing);

    return this.smoothedBeat;
  }

  /**
   * Get current beat value (0-1)
   */
  getBeat() {
    return this.smoothedBeat;
  }

  /**
   * Set speaking state (reduces beat amplitude during TTS)
   */
  setSpeaking(speaking) {
    this.isSpeaking = speaking;
    if (speaking) {
      console.log('[AudioAnalyzer] Speech active, ducking beat');
    }
  }

  /**
   * Stop analysis
   */
  stop() {
    this.isActive = false;
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
  }

  /**
   * Resume analysis
   */
  resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    this.isActive = true;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

export default AudioAnalyzer;
