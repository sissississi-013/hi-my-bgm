/**
 * prompt-fusion.js - Build MusicHero prompts from state/page/cues
 */

const DEFAULT_OPTIONS = {
  instrumentalOnly: true,
  allowLyric: true,
  durationSec: 30
};

const STATE_TEXTURES = {
  focused: 'steady low-beta pulses, soft analog pads, gentle shimmer highlights',
  neutral: 'calm lofi beds, sparse keys, relaxed breathing pulses',
  distracted: 'refocus pulse, minimal melody, warm plucks guiding attention back',
  idle: 'weightless ambient layers, long pads, soft exhale swells'
};

const CONTEXT_HINTS = [
  { match: (host, snippet) => host.includes('github'), text: 'coding dark ui with subtle futuristic edges' },
  { match: (host, snippet) => host.includes('notion'), text: 'minimal writing workspace with clarity and space' },
  { match: (host, snippet) => host.includes('metorial'), text: 'ai memory platform with confident forward motion' },
  { match: (host, snippet) => host.includes('ycombinator'), text: 'startup inspiration hub with maker energy' },
  { match: (host, snippet) => snippet.includes('documentation'), text: 'documentation session, detail-friendly atmosphere' },
  { match: () => true, text: 'general productivity flow in a premium workspace' }
];

function preview(value = '', limit = 180) {
  return value.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function buildContextText(host, snippet) {
  const snippetLower = snippet.toLowerCase();
  const match = CONTEXT_HINTS.find((item) => item.match(host, snippetLower));
  return match ? match.text : CONTEXT_HINTS[CONTEXT_HINTS.length - 1].text;
}

function buildLyricHook(host) {
  if (host.includes('ycombinator')) {
    return 'make something people want';
  }
  if (host.includes('metorial')) {
    return 'Metorial mode on—building memory that matters';
  }
  return '';
}

function describeCues(label, cues = {}) {
  const parts = [];

  if (typeof cues.sleepHours === 'number' && cues.sleepHours <= 3) {
    parts.push('urgent energizing drum grooves, crisp percussion accents, motivational lift');
  }

  if (cues.mood === 'tired') {
    parts.push('bright support energy, friendly momentum, subtle major swells');
  }

  if (cues.mood === 'happy') {
    parts.push('joyful but focus-safe motifs, sparkling chords, light bounce');
  }

  if (label === 'distracted') {
    parts.push('gently steering attention with minimal repeating motifs and calm bass pulses');
  }

  if (label === 'focused' && parts.length === 0) {
    parts.push('locked-in focus cadence, no lyrical distractions, tight rhythmic bed');
  }

  return parts.join('; ');
}

export function fusePrompt(state, page, cues, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const label = state?.label || 'neutral';
  const host = (page?.host || '').toLowerCase();
  const titleRaw = page?.title || '';
  const snippetRaw = page?.snippet || '';
  const snippet = preview(snippetRaw, 220);

  const contextText = buildContextText(host, snippetRaw || '');
  const lyricHook = buildLyricHook(host);

  const base = `Create loopable ${label} background music with ${STATE_TEXTURES[label] || STATE_TEXTURES.neutral}.`;
  const scene = `Scene: ${contextText}. Title or tab: "${titleRaw || host || 'current task'}".`;
  const snippetLine = snippet ? `Key on-screen phrases: "${snippet}".` : '';
  const cueLine = describeCues(label, cues || {});

  const promptParts = [base, scene, snippetLine, cueLine].filter(Boolean);
  const prompt = promptParts.join(' ');

  const allowLyric = opts.allowLyric !== false;
  const instrumentalOnly = opts.instrumentalOnly !== undefined ? opts.instrumentalOnly : DEFAULT_OPTIONS.instrumentalOnly;
  const durationSec = opts.durationSec || DEFAULT_OPTIONS.durationSec;

  const useLyrics = Boolean(lyricHook && allowLyric && !instrumentalOnly);

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
