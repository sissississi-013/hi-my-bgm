/**
 * planet-bubble.js - Three.js powered planet bubble with shader animation
 * Renders flowing color fields with WebGL, fallback to CSS
 */

// Mood configurations mapped to shader uniforms
const MOODS = {
  focused: {
    hue: 0.57,        // luminous cyan/blue
    flow: 0.75,
    distort: 0.28,
    luma: 0.86,
    beatAmt: 0.28,
    colors: {
      primary: 'rgba(86, 212, 255, 0.82)',
      secondary: 'rgba(139, 126, 255, 0.55)',
      base: 'rgba(12, 24, 52, 0.94)'
    }
  },
  neutral: {
    hue: 0.60,        // cool spectrum blue
    flow: 0.4,
    distort: 0.18,
    luma: 0.78,
    beatAmt: 0.18,
    colors: {
      primary: 'rgba(126, 158, 255, 0.72)',
      secondary: 'rgba(94, 220, 255, 0.48)',
      base: 'rgba(18, 26, 48, 0.92)'
    }
  },
  distracted: {
    hue: 0.04,        // warm alert hue
    flow: 1.15,
    distort: 0.45,
    luma: 0.88,
    beatAmt: 0.35,
    colors: {
      primary: 'rgba(255, 142, 116, 0.86)',
      secondary: 'rgba(255, 94, 172, 0.55)',
      base: 'rgba(48, 16, 32, 0.9)'
    }
  },
  idle: {
    hue: 0.54,        // soft calm blue
    flow: 0.25,
    distort: 0.12,
    luma: 0.72,
    beatAmt: 0.12,
    colors: {
      primary: 'rgba(112, 214, 214, 0.78)',
      secondary: 'rgba(92, 168, 255, 0.48)',
      base: 'rgba(16, 30, 52, 0.9)'
    }
  },
  upbeat: {
    hue: 0.82,        // magenta/cyan pop
    flow: 0.95,
    distort: 0.35,
    luma: 0.9,
    beatAmt: 0.32,
    colors: {
      primary: 'rgba(255, 94, 214, 0.78)',
      secondary: 'rgba(94, 224, 255, 0.6)',
      base: 'rgba(20, 18, 52, 0.92)'
    }
  }
};

const MOOD_NAMES = Object.keys(MOODS);

// Fragment shader for flowing color field
const PLANET_SHADER = `
precision mediump float;

uniform float uTime;
uniform float uHue;
uniform float uFlow;
uniform float uDistort;
uniform float uLuma;
uniform float uBeat;
uniform vec2 uResolution;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 5; i++) {
    value += amplitude * (noise(p * frequency) * 2.0 - 1.0);
    frequency *= 2.0;
    amplitude *= 0.5;
  }

  return value;
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 center = vec2(0.5);
  vec2 pos = uv - center;

  float dist = length(pos);

  if (dist > 0.5) {
    discard;
  }

  float radial = dist / 0.5;
  float angle = atan(pos.y, pos.x);
  float time = uTime * (0.6 + uFlow);

  vec2 flowPos = vec2(angle * 1.25, radial * (4.0 + uDistort * 2.2));
  flowPos += vec2(
    cos(angle * 2.0 + time * 0.8),
    sin(angle * 1.7 - time * 0.6)
  ) * (0.35 + uDistort * 0.2);

  float texture = fbm(flowPos + time * 0.12 * uFlow);
  float secondary = fbm(flowPos * 1.8 - time * 0.1);

  float swirl = sin(angle * 5.5 + time * 1.2);
  float banding = sin(radial * 16.0 - time * (1.4 + uFlow) + swirl * (1.5 + uDistort * 2.0));
  float ripple = sin(radial * 8.0 + angle * 3.0 - time * 1.1);

  float beatInfluence = uBeat * (0.25 + uDistort * 0.2);

  float hue = uHue + swirl * 0.05 + banding * (0.04 + uDistort * 0.12) + ripple * 0.02 + texture * 0.035 + beatInfluence * 0.04;
  float sat = clamp(0.68 + uDistort * 0.25 + secondary * 0.05, 0.45, 0.95);
  float value = clamp(uLuma + (1.0 - radial) * 0.35 + beatInfluence * 0.18 + texture * 0.08 + ripple * 0.04, 0.0, 1.2);

  vec3 color = hsv2rgb(vec3(hue, sat, value));

  float rim = smoothstep(0.78, 1.0, radial);
  vec3 rimColor = hsv2rgb(vec3(hue + 0.1, 0.4, 1.0));
  color = mix(color, rimColor, rim * 0.55);

  float innerGlow = smoothstep(0.0, 0.42, 1.0 - radial);
  color += innerGlow * vec3(0.22, 0.26, 0.3);

  float highlight = smoothstep(0.0, 0.45, 0.5 - distance(pos, vec2(-0.12, 0.18)));
  color += highlight * 0.25;

  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

export class PlanetBubble {
  constructor(container, options = {}) {
    this.container = container;
    this.size = options.size || 72;
    this.useWebGL = this.detectWebGL() && !this.prefersReducedMotion();

    this.mood = 'neutral';
    this.beat = 0;
    this.time = 0;
    this.isPlaying = false;
    this.moodClasses = MOOD_NAMES;
    this.paletteOverride = null;

    const baseMood = MOODS[this.mood];
    this.shaderState = {
      current: { ...baseMood },
      target: { ...baseMood }
    };

    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.uniforms = {};
    this.animationFrame = null;
    this.lastFrameTime = 0;
    this.targetFPS = 30;

    this.init();
    if (this.container) {
      this.container.style.setProperty('--planet-beat', '0');
    }
    this.setMood(this.mood);
  }

  detectWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  }

  prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  init() {
    if (this.useWebGL) {
      this.initWebGL();
    } else {
      this.initCSS();
    }
  }

  initWebGL() {
    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size * 2; // Retina
    this.canvas.height = this.size * 2;
    this.canvas.style.width = `${this.size}px`;
    this.canvas.style.height = `${this.size}px`;
    this.canvas.className = 'planet-canvas';

    this.container.appendChild(this.canvas);
    this.container.classList.remove('planet-has-css');
    this.container.classList.add('planet-has-webgl');

    // Get WebGL context
    this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');

    if (!this.gl) {
      console.warn('[Planet] WebGL not available, falling back to CSS');
      this.useWebGL = false;
      this.container.classList.remove('planet-has-webgl');
      this.initCSS();
      return;
    }

    // Compile shader
    this.setupShader();

    // Start render loop
    this.startAnimation();
  }

  setupShader() {
    const gl = this.gl;

    // Vertex shader (simple quad)
    const vertexShaderSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    // Fragment shader
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, PLANET_SHADER);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('[Planet] Shader compile error:', gl.getShaderInfoLog(fragmentShader));
      return;
    }

    // Link program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('[Planet] Program link error:', gl.getProgramInfoLog(this.program));
      return;
    }

    gl.useProgram(this.program);

    // Setup geometry (fullscreen quad)
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(this.program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    this.uniforms = {
      uTime: gl.getUniformLocation(this.program, 'uTime'),
      uHue: gl.getUniformLocation(this.program, 'uHue'),
      uFlow: gl.getUniformLocation(this.program, 'uFlow'),
      uDistort: gl.getUniformLocation(this.program, 'uDistort'),
      uLuma: gl.getUniformLocation(this.program, 'uLuma'),
      uBeat: gl.getUniformLocation(this.program, 'uBeat'),
      uResolution: gl.getUniformLocation(this.program, 'uResolution')
    };

    // Set resolution
    gl.uniform2f(this.uniforms.uResolution, this.canvas.width, this.canvas.height);
  }

  initCSS() {
    // Fallback: create div with CSS gradient
    let planet = this.container.querySelector('.planet-css-fallback');
    if (!planet) {
      planet = document.createElement('div');
      planet.className = 'planet-css-fallback';
      planet.style.position = 'absolute';
      planet.style.width = '100%';
      planet.style.height = '100%';
      planet.style.top = '0';
      planet.style.left = '0';
      this.container.appendChild(planet);
    }
    this.container.classList.remove('planet-has-webgl');
    this.container.classList.add('planet-has-css');
    this.canvas = planet; // Store reference
  }

  startAnimation() {
    if (!this.useWebGL) return;

    const animate = (currentTime) => {
      // Cap to target FPS
      const elapsed = currentTime - this.lastFrameTime;
      const targetFrameTime = 1000 / this.targetFPS;

      if (elapsed >= targetFrameTime) {
        this.lastFrameTime = currentTime - (elapsed % targetFrameTime);
        this.render();
      }

      // Pause when tab hidden
      if (!document.hidden) {
        this.animationFrame = requestAnimationFrame(animate);
      }
    };

    this.animationFrame = requestAnimationFrame(animate);

    // Resume when tab becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !this.animationFrame) {
        this.animationFrame = requestAnimationFrame(animate);
      }
    });
  }

  render() {
    if (!this.gl || !this.program) return;

    const gl = this.gl;
    const palette = this.getActivePalette();

    this.easeShaderState(palette);
    const shaderValues = this.shaderState.current;

    // Update time
    this.time += 1 / this.targetFPS;

    // Set uniforms
    gl.uniform1f(this.uniforms.uTime, this.time);
    gl.uniform1f(this.uniforms.uHue, shaderValues.hue);
    gl.uniform1f(this.uniforms.uFlow, shaderValues.flow);
    gl.uniform1f(this.uniforms.uDistort, shaderValues.distort);
    gl.uniform1f(this.uniforms.uLuma, shaderValues.luma);
    gl.uniform1f(this.uniforms.uBeat, this.beat * shaderValues.beatAmt);

    // Clear and draw
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  setMood(newMood) {
    if (MOODS[newMood]) {
      this.mood = newMood;

      if (this.container) {
        this.moodClasses.forEach(name => this.container.classList.remove(name));
        this.container.classList.add(newMood);
      }

      this.updateShaderTargets();
      this.applyPaletteToCSS();
    }
  }

  setBeat(beatValue) {
    this.beat = Math.max(0, Math.min(1, beatValue));
    if (this.container) {
      this.container.style.setProperty('--planet-beat', this.beat.toFixed(3));
    }
  }

  setPlaying(playing) {
    this.isPlaying = playing;
    if (this.container) {
      this.container.classList.toggle('planet-playing', !!playing);
      if (!playing) {
        this.container.style.setProperty('--planet-beat', '0');
      }
    }
  }

  setPaletteOverride(palette = null) {
    if (palette) {
      this.paletteOverride = {
        ...palette,
        colors: {
          ...(MOODS[this.mood]?.colors || {}),
          ...(palette.colors || {})
        }
      };
    } else {
      this.paletteOverride = null;
    }

    this.updateShaderTargets();
    this.applyPaletteToCSS();
  }

  getActivePalette() {
    const mood = MOODS[this.mood] || MOODS.neutral;
    if (!this.paletteOverride) {
      return mood;
    }

    return {
      ...mood,
      ...this.paletteOverride,
      colors: {
        ...(mood.colors || {}),
        ...(this.paletteOverride.colors || {})
      }
    };
  }

  updateShaderTargets() {
    const palette = this.getActivePalette();
    if (!this.shaderState) {
      this.shaderState = {
        current: { ...palette },
        target: { ...palette }
      };
      return;
    }

    this.shaderState.target = {
      hue: palette.hue,
      flow: palette.flow,
      distort: palette.distort,
      luma: palette.luma,
      beatAmt: palette.beatAmt
    };
  }

  easeShaderState(palette) {
    if (!this.shaderState) {
      this.shaderState = {
        current: { ...palette },
        target: { ...palette }
      };
      return;
    }

    const smoothing = 0.08;
    const fields = ['hue', 'flow', 'distort', 'luma', 'beatAmt'];
    const current = this.shaderState.current;
    const target = this.shaderState.target;

    fields.forEach((key) => {
      const targetValue = target[key] ?? palette[key];
      const currentValue = current[key] ?? palette[key];
      current[key] = currentValue + (targetValue - currentValue) * smoothing;
    });
  }

  applyPaletteToCSS() {
    if (!this.container) return;

    const palette = this.getActivePalette();
    const colors = palette.colors || {};

    const setVar = (name, value) => {
      if (value) {
        this.container.style.setProperty(name, value);
      } else {
        this.container.style.removeProperty(name);
      }
    };

    setVar('--planet-primary', colors.primary);
    setVar('--planet-secondary', colors.secondary);
    setVar('--planet-tertiary', colors.base || colors.tertiary);
    setVar('--planet-highlight', colors.primary);

    if (!this.useWebGL && this.canvas) {
      this.canvas.style.setProperty('--planet-primary', colors.primary || 'rgba(126, 158, 255, 0.72)');
      this.canvas.style.setProperty('--planet-secondary', colors.secondary || 'rgba(94, 220, 255, 0.48)');
      if (colors.base || colors.tertiary) {
        this.canvas.style.setProperty('--planet-tertiary', colors.base || colors.tertiary);
      } else {
        this.canvas.style.removeProperty('--planet-tertiary');
      }
    }
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    if (this.canvas) {
      this.canvas.remove();
    }
  }
}

export default PlanetBubble;
