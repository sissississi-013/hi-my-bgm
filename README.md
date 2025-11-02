# HI MY BGM

**An agentic focus companion that senses your vibe and plays adaptive music.**

A Chrome Extension (Manifest V3) designed primarily for ADHD/neurodivergent users. HI MY BGM is a floating circular bubble that observes your behavior (typing, tab switching, mouse movement), infers your focus state, displays expressive faces with color and halo animations, and plays or generates adaptive music.

**Gentle. Non-judgmental. Low friction.**

---

## Features

- **Behavior-aware bubble**: 60px floating circle (bottom-right by default) that responds to your focus state
- **Privacy-first observation**: Only stores timestamps and counters—never keystrokes or URLs
- **Adaptive music**: Plays state-appropriate music via YouTube (default), Spotify (optional), or AI-generated audio (future)
- **Expressive faces**: Visual feedback with emoji, colors, and animated halos
- **Voice feedback**: Optional TTS messages via Coval AI or Web Speech API
- **AI-powered reasoning**: Optional integrations for personalized, supportive messages
- **Fully opt-in integrations**: All cloud services are optional and fail-graceful

---

## States & Modes

| State | Icon | Color | Trigger | Music Mode |
|-------|------|-------|---------|------------|
| **Focused** | 😄 | Cyan/Blue | Recent keyboard activity (<4s) | Focus (low-BPM, structured) |
| **Neutral** | 😐 | Gray | Default, steady activity | Calm (ambient pads) |
| **Distracted** | 😟 | Orange/Red | High tab switching (>5 in 10s) | Refocus (rhythmic re-engagement) |
| **Idle** | 😴 | Green | No input for 10s+ | Calm (minimal transients) |

Music modes are **brainwave-inspired** (not medical claims): Focus/Alpha-friendly, Refocus/rhythmic, Calm/Theta-friendly.

---

## Sponsor Integrations

All integrations are **opt-in** and **fail-graceful**. The extension runs fully with defaults (YouTube + local rules + Web Speech API).

### **Metorial AI** ([metorial.com](https://metorial.com))
- **Purpose**: User memory & personalization
- **Provides**: User profiles, session summaries, threshold tuning
- **Fallback**: Local storage (chrome.storage.sync)

### **Captain AI** ([docs.runcaptain.com](https://docs.runcaptain.com/))
- **Purpose**: Agent orchestration for reasoning
- **Provides**: Routes LLM prompts and tool calls for supportive messages
- **Fallback**: Direct LLM calls (Anthropic/OpenAI) or local fallback messages

### **Coval AI** ([coval.dev](https://www.coval.dev/))
- **Purpose**: Voice TTS/feedback
- **Provides**: High-quality text-to-speech for bubble messages
- **Fallback**: Web Speech API (built-in browser TTS)

---

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the `hi-my-bgm/` folder
6. The bubble should appear on any page you visit

### Icons

Replace placeholder icon files in `/assets/` with actual PNG icons:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

Recommended: Use a circular gradient bubble face design (cyan/blue to purple).

---

## Configuration

### Options Page

Open via:
- Extension popup → Settings (⚙️ button)
- `chrome://extensions/` → HI MY BGM → Options

**Settings available:**
- **Behavior thresholds**: Idle timeout, distraction threshold
- **Appearance**: Bubble position, color theme
- **Music backend**: YouTube (default), Spotify (optional)
- **AI integrations**: Captain, Metorial, Coval, OpenAI, Anthropic (all optional)

### API Keys

To use sponsor integrations:

1. Obtain API keys:
   - **Captain AI**: [docs.runcaptain.com](https://docs.runcaptain.com/)
   - **Metorial AI**: [metorial.com](https://metorial.com)
   - **Coval AI**: [coval.dev](https://www.coval.dev/)
   - **OpenAI**: [platform.openai.com](https://platform.openai.com/)
   - **Anthropic**: [console.anthropic.com](https://console.anthropic.com/)
   - **Spotify**: [developer.spotify.com](https://developer.spotify.com/)

2. Enter keys in Options page
3. Toggle service on/off as needed

**Keys are stored in `chrome.storage.sync`** (never sent anywhere except the respective service APIs).

---

## Privacy

**HI MY BGM is privacy-first by design:**

- **No keystrokes captured**: Only timestamps of key events
- **No URLs recorded**: Tab switching is counted, not tracked
- **No mouse coordinates**: Only timestamps of mouse movement
- **Opt-in cloud calls**: All external APIs require explicit user consent
- **Local fallbacks**: Extension works fully offline with defaults
- **Session summaries**: Anonymous behavioral summaries (no PII)

All raw data stays local. Cloud integrations (if enabled) only receive:
- Current state label (focused/distracted/idle/neutral)
- Anonymized behavioral counters
- User-provided preferences (via Metorial)

---

## Development

### Structure

```
hi-my-bgm/
  manifest.json
  /background/          # Service worker, tab activity tracking
  /content/             # Overlay UI (bubble, CSS, SVG)
  /lib/                 # Core logic (state, observe, reason, act)
  /music/               # Music adapters (YouTube, Spotify, AI)
  /ai/                  # AI integrations (Captain, Metorial, LLM router)
  /voice/               # Voice TTS (Coval)
  /popup/               # Extension popup UI
  /options/             # Settings page
  /assets/              # Icons, logos
  README.md
  .env.sample
```

### Tech Stack

- **Vanilla JavaScript** (no build step)
- **Manifest V3** (service worker, scripting API)
- **Chrome Extensions APIs**: tabs, storage, scripting, notifications
- **Web Audio API**: Music playback (YouTube iframe)
- **Web Speech API**: TTS fallback

### Adding a New Integration

1. Add feature flag to `lib/sponsor.js`
2. Create adapter in `/ai/`, `/music/`, or `/voice/`
3. Update `options.html` with toggle + inputs
4. Update `.env.sample` and README

---

## Roadmap

- [ ] **Spotify Web Playback SDK**: Full integration for premium users
- [ ] **AI-generated music**: OpenAI audio generation or Mubert API
- [ ] **Wake word detection**: "Hey BGM" via Coval voice input
- [ ] **Advanced personalization**: ML-based threshold tuning via Metorial
- [ ] **Multi-device sync**: Session summaries across devices
- [ ] **Desktop app**: Electron wrapper for system-wide observation
- [ ] **Mobile companion**: React Native app with shared profiles

---

## FAQ

### Why does the bubble need tab permissions?

To count tab switches for distraction detection. We never read tab URLs or content.

### Can I use this without any AI services?

**Yes!** The extension runs fully with:
- YouTube music (default, no auth)
- Local rule-based reasoning (no AI)
- Web Speech API (browser TTS)

### How do I disable voice feedback?

Uncheck "Coval AI" in Options. The extension will stop speaking messages.

### Why is music not playing?

- Browser may block autoplay. Click the page once to allow audio.
- Check that YouTube is enabled in Options.
- Try disabling and re-enabling the extension.

### Can I contribute?

Yes! See `CONTRIBUTING.md` (coming soon). For now, open issues or PRs on GitHub.

---

## License

**MIT License**

Copyright (c) 2025 HI MY BGM Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## Acknowledgments

**Powered by:**

- **[Captain AI](https://docs.runcaptain.com/)** - Agent orchestration for reasoning workflows
- **[Metorial AI](https://metorial.com)** - User memory, profiles, and personalization
- **[Coval AI](https://www.coval.dev/)** - High-quality voice TTS and feedback

**Music sources:**
- YouTube (Creative Commons and public domain ambient/focus tracks)
- Spotify playlists (user-provided premium accounts)

**Inspiration:**
- ADHD community feedback and neurodivergent-friendly design principles
- Brainwave entrainment research (no medical claims)

---

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/hi-my-bgm/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/hi-my-bgm/discussions)
- **Email**: support@himybgm.com (coming soon)

**Made with 💙 for focus-seekers everywhere.**
