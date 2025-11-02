# Planet Bubble Integration Guide

## 🎨 What's Been Built

The new "Planet Bubble" design system has been created with these components:

### ✅ Completed Files

1. **`content/planet-bubble.js`** - WebGL shader-based planet renderer
   - Fragment shader with flowing noise/color fields (FBM/Perlin-like)
   - State-to-mood mapping (focused, neutral, distracted, idle, upbeat)
   - 30 FPS cap for performance
   - Automatic WebGL detection with CSS fallback
   - Reduced motion support

2. **`content/audio-analyzer.js`** - Audio reactivity system
   - WebAudio API integration
   - Beat detection and envelope smoothing
   - TTS ducking (reduces beat during voice)
   - Simulated beat for YouTube (CORS limitation workaround)

3. **`content/faces.svg`** - SVG line-art face definitions
   - 5 face expressions: focused, neutral, distracted, idle, upbeat
   - Minimal stroke-based design (no emoji)
   - Smooth path morphing
   - Micro-animations (pupil jitter on distracted, sparkles on upbeat)

4. **`content/overlay.css`** (UPDATED) - Planet styling
   - 72px planet container
   - WebGL canvas integration
   - CSS gradient fallback
   - Halo animations (BPM-synced)
   - Glossy rim effect
   - Full accessibility (reduced motion, high contrast)

5. **`content/overlay.html`** (UPDATED) - New structure
   - SVG face overlay container
   - Planet container for WebGL/CSS
   - Halo ring element

---

## 🔧 Integration Steps (To Complete)

###  Step 1: Update `overlay.js` to Import Modules

At the top of `overlay.js`, after line 5, add:

```javascript
// Import planet bubble system (ES6 modules via chrome.runtime.getURL)
import { PlanetBubble } from './planet-bubble.js';
import { AudioAnalyzer } from './audio-analyzer.js';
```

**Note**: Since Chrome extensions don't support ES6 imports in content scripts by default, you'll need to either:
- **Option A**: Convert to use dynamic `import()`
- **Option B**: Bundle with a tool like Rollup/esbuild
- **Option C**: Include as inline scripts (simplest for now)

**Recommended Quick Fix** (Option C):
Load the modules dynamically:

```javascript
// After line 18 in overlay.js
const PlanetBubble = await import(chrome.runtime.getURL('content/planet-bubble.js')).then(m => m.PlanetBubble);
const AudioAnalyzer = await import(chrome.runtime.getURL('content/audio-analyzer.js')).then(m => m.AudioAnalyzer);
```

### Step 2: Load SVG Face Definitions

After creating the bubble element (around line 57), load the faces:

```javascript
// Load face SVG definitions
const facesResponse = await fetch(chrome.runtime.getURL('content/faces.svg'));
const facesText = await facesResponse.text();
const parser = new DOMParser();
const facesDoc = parser.parseFromString(facesText, 'image/svg+xml');
const facesDefs = facesDoc.querySelector('defs');

// Inject into document
const facesContainer = document.createElement('div');
facesContainer.style.display = 'none';
facesContainer.innerHTML = facesText;
document.body.appendChild(facesContainer);
```

### Step 3: Initialize Planet Bubble

Replace the bubble innerHTML creation (lines 38-44) with:

```javascript
// Create bubble structure
bubble.innerHTML = `
  <div class="hmb-bubble neutral" id="hmb-bubble">
    <div class="hmb-planet-container" id="hmb-planet-container"></div>
    <div class="hmb-face" id="hmb-face">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <use id="hmb-face-use" href="#face-neutral" />
      </svg>
    </div>
    <div class="hmb-halo" id="hmb-halo"></div>
  </div>
  <div class="hmb-status" id="hmb-status">neutral</div>
`;

// After appending to body, initialize planet
const planetContainer = document.getElementById('hmb-planet-container');
const planet = new PlanetBubble(planetContainer, { size: 72 });
```

### Step 4: Initialize Audio Analyzer

After planet initialization:

```javascript
const audioAnalyzer = new AudioAnalyzer();
audioAnalyzer.init();

// Try to connect to YouTube iframe if exists
const connectAudio = () => {
  const youtubeIframe = document.querySelector('iframe[id="hmb-youtube-player"]');
  if (youtubeIframe) {
    audioAnalyzer.connectToYouTube(youtubeIframe);
  }
};

// Check periodically for YouTube player
setInterval(connectAudio, 2000);
```

### Step 5: Update `updateBubble()` Function

Replace the existing `updateBubble(label)` function (around line 195) with:

```javascript
function updateBubble(label) {
  bubbleEl.className = `hmb-bubble ${label}`;
  if (state.isPlaying) {
    bubbleEl.classList.add('playing');
  }

  // Update planet mood
  planet.setMood(label);

  // Update face SVG
  const faceUse = document.getElementById('hmb-face-use');
  if (faceUse) {
    // Add transition class
    const faceEl = document.getElementById('hmb-face');
    faceEl.classList.add('transitioning');

    setTimeout(() => {
      faceUse.setAttribute('href', `#face-${label}`);
      faceEl.classList.remove('transitioning');
    }, 150);
  }
}
```

### Step 6: Add Beat Update Loop

In the main tick function (around line 160), add after state update:

```javascript
// Update audio beat
if (state.isPlaying && audioAnalyzer) {
  const beat = audioAnalyzer.analyze();
  planet.setBeat(beat);

  // Add beat pulse class on strong beats
  if (beat > 0.7) {
    bubbleEl.classList.add('beating');
    setTimeout(() => bubbleEl.classList.remove('beating'), 150);
  }
}
```

### Step 7: Handle TTS/Voice Speaking

When voice speaks (in voice.speak()), add:

```javascript
// Before speaking
audioAnalyzer.setSpeaking(true);

// After speaking completes
audioAnalyzer.setSpeaking(false);
```

### Step 8: Update Manifest for ES6 Modules

In `manifest.json`, update content_scripts to:

```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["content/overlay.js"],
    "css": ["content/overlay.css"],
    "run_at": "document_end",
    "all_frames": false
  }
],
"web_accessible_resources": [
  {
    "resources": [
      "content/overlay.html",
      "content/faces.svg",
      "content/planet-bubble.js",
      "content/audio-analyzer.js"
    ],
    "matches": ["<all_urls>"]
  }
]
```

---

## 🎯 Testing Checklist

After integration:

- [ ] Planet appears with flowing colors (WebGL) or gradient (fallback)
- [ ] Face changes between states (focused → neutral → distracted → idle)
- [ ] Halo pulses only when music is playing
- [ ] Beat detection affects planet scale/halo (if audio connected)
- [ ] Reduced motion shows static gradient instead of shader
- [ ] Planet size is 72px, positioned bottom-right
- [ ] Hover shows status text
- [ ] Performance: ~1-3% CPU when idle, ≤5% when animating

---

## 🐛 Troubleshooting

### WebGL Not Rendering
- Check console for shader compilation errors
- Verify browser supports WebGL (check `canvas.getContext('webgl')`)
- Falls back to CSS gradient automatically

### Face Not Changing
- Verify faces.svg loaded correctly
- Check `#hmb-face-use` element exists
- Ensure SVG symbols have correct IDs (#face-focused, #face-neutral, etc.)

### No Audio Reactivity
- YouTube iframe audio is CORS-blocked (expected)
- Simulated beat should still work (~120 BPM)
- Check console for AudioAnalyzer messages

### Performance Issues
- Verify FPS capped to 30 (check planet-bubble.js targetFPS)
- Ensure animation pauses when tab hidden
- Check reduced motion preference isn't forcing CPU mode

---

## 📊 Architecture

```
overlay.js (orchestrator)
├── planet-bubble.js (WebGL shader + CSS fallback)
│   └── GLSL fragment shader (noise-based color fields)
├── audio-analyzer.js (beat detection)
│   └── WebAudio API → beat envelope
├── faces.svg (SVG symbol definitions)
│   └── 5 line-art face expressions
└── overlay.css (styling + animations)
    └── Halo animations, transitions, accessibility
```

---

## 🚀 Next Steps

1. Follow integration steps above
2. Test on a regular website (not chrome://)
3. Verify all states work (type, switch tabs, stay idle)
4. Check audio reactivity with music playing
5. Test accessibility (reduced motion, high contrast)
6. Commit final integrated version

---

## 💡 Future Enhancements

- **Three.js full 3D**: Replace 2D shader with rotating 3D sphere
- **Video textures**: Use AI-generated nebula videos as planet surface
- **Particle system**: Add floating particles around planet
- **Gesture controls**: Drag to reposition, pinch to resize
- **Custom faces**: User-uploaded SVG faces
- **Audio spectrum**: Visualize frequency bands on planet surface

---

Generated: 2025-11-02
Status: Foundation complete, integration pending
