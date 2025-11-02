/**
 * prompt-fusion.js - Build MusicHero prompts from state/page/cues
 */

const DEFAULT_OPTIONS = {
  instrumentalOnly: true,
  allowLyric: true,
  durationSec: 30
};

export function fusePrompt(state, page, cues, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const label = state?.label || 'neutral';
  const host = (page?.host || '').toLowerCase();
  const titleRaw = page?.title || '';
  const snippetRaw = page?.snippet || '';
  const title = titleRaw.toLowerCase();
  const snippetLower = snippetRaw.toLowerCase();

  const context =
    host.includes('github') ? 'coding dark ui'
      : host.includes('notion') ? 'minimal writing workspace'
      : host.includes('metorial') ? 'ai memory platform'
      : host.includes('ycombinator') ? 'startup inspiration hub'
      : snippetLower.includes('documentation') ? 'documentation session'
      : 'general productivity';

  let lyricHook = '';
  if (host.includes('ycombinator')) {
    lyricHook = 'make something people want';
  } else if (host.includes('metorial')) {
    lyricHook = 'Metorial mode on—building memory that matters';
  }

  const cuesInfo = cues || {};
  let tempoHint = '';
  let mood = label;

  if (typeof cuesInfo.sleepHours === 'number' && cuesInfo.sleepHours <= 3) {
    tempoHint = 'energizing focus, gentle percussion, positive drive';
    mood = 'focused';
  }
  if (cuesInfo.mood === 'tired') {
    tempoHint = tempoHint || 'energizing focus';
  }
  if (cuesInfo.mood === 'happy') {
    tempoHint = 'upbeat but non-distracting, major textures';
  }

  if (label === 'distracted') {
    tempoHint = tempoHint || 'refocus, alpha-wave friendly, minimal melody';
  }
  if (label === 'focused') {
    tempoHint = tempoHint || 'steady low-beta, lo-fi synth pads, no vocals';
  }

  const safeTitle = titleRaw || host || 'current task';
  const base = `loopable ${mood} background music for ${context} titled "${safeTitle}" with alpha/low-beta friendly rhythm`;
  const snippetTag = snippetRaw ? `reference on-screen text: ${snippetRaw.replace(/\s+/g, ' ').trim().slice(0, 140)}` : '';
  const prompt = [base, tempoHint, snippetTag].filter(Boolean).join(', ');

  const allowLyric = opts.allowLyric !== false;
  const instrumentalOnly = opts.instrumentalOnly !== undefined ? opts.instrumentalOnly : DEFAULT_OPTIONS.instrumentalOnly;
  const durationSec = opts.durationSec || DEFAULT_OPTIONS.durationSec;

  const useLyrics = !!lyricHook && allowLyric && !instrumentalOnly;

  return {
    prompt,
    lyricHook: useLyrics ? lyricHook : '',
    instrumental: instrumentalOnly || !useLyrics,
    durationSec
  };
}

export default {
  fusePrompt
};
