/**
 * planet-bubble.js - Three.js powered planet bubble with shader animation
 * Renders flowing color fields with WebGL, fallback to CSS
 */

// Mood configurations mapped to shader uniforms
const MOODS = {
  focused: {
    hue: 0.55,        // cyan/blue
    flow: 0.6,
    distort: 0.25,
    luma: 0.85,
    beatAmt: 0.2,
    colors: { primary: '#1fb6ff', secondary: '#00bcd4' }
  },
  neutral: {
    hue: 0.60,        // cool gray blue
    flow: 0.3,
    distort: 0.10,
    luma: 0.75,
    beatAmt: 0.1,
    colors: { primary: '#9e9e9e', secondary: '#b0bec5' }
  },
  distracted: {
    hue: 0.06,        // orange/red
    flow: 1.0,
    distort: 0.45,
    luma: 0.90,
    beatAmt: 0.35,
    colors: { primary: '#ff7849', secondary: '#ff4ecd' }
  },
  idle: {
    hue: 0.40,        // soft green/blue
    flow: 0.2,
    distort: 0.05,
    luma: 0.65,
    beatAmt: 0.08,
    colors: { primary: '#22c55e', secondary: '#4caf50' }
  },
  upbeat: {
    hue: 0.85,        // magenta/cyan
    flow: 0.8,
    distort: 0.30,
    luma: 0.90,
    beatAmt: 0.30,
    colors: { primary: '#ff4ecd', secondary: '#1fb6ff' }
  }
};

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

// Simple 2D noise function (Perlin-like)
float noise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;

  for (int i = 0; i < 4; i++) {
    value += amplitude * (noise(p * frequency) * 2.0 - 1.0);
    frequency *= 2.0;
    amplitude *= 0.5;
  }

  return value;
}

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 center = vec2(0.5, 0.5);
  vec2 pos = uv - center;

  float dist = length(pos);

  // Circle mask
  if (dist > 0.5) {
    discard;
  }

  // Flow field based on time and mood parameters
  vec2 flowPos = pos * (2.0 + uDistort);
  flowPos.x += uTime * uFlow * 0.1;
  flowPos.y += sin(uTime * uFlow * 0.2) * 0.3;

  // Generate flowing pattern
  float pattern = fbm(flowPos * 3.0 + uTime * uFlow * 0.05);
  pattern += fbm(flowPos * 5.0 - uTime * uFlow * 0.03) * 0.5;

  // Add beat influence
  float beatInfluence = uBeat * 0.3;
  pattern += beatInfluence * sin(dist * 10.0 - uTime * 2.0);

  // Map to color
  float hue = uHue + pattern * 0.1;
  float sat = 0.6 + pattern * 0.2;
  float lum = uLuma - dist * 0.3;

  vec3 color = hsv2rgb(vec3(hue, sat, lum));

  // Add glossy rim
  float rim = smoothstep(0.42, 0.50, dist);
  color = mix(color, vec3(1.0), rim * 0.4);

  // Inner glow
  float glow = 1.0 - smoothstep(0.0, 0.3, dist);
  color += glow * 0.2;

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

    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.uniforms = {};
    this.animationFrame = null;
    this.lastFrameTime = 0;
    this.targetFPS = 30;

    this.init();
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

    // Get WebGL context
    this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');

    if (!this.gl) {
      console.warn('[Planet] WebGL not available, falling back to CSS');
      this.useWebGL = false;
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
    const planet = document.createElement('div');
    planet.className = 'planet-css-fallback';
    planet.style.width = `${this.size}px`;
    planet.style.height = `${this.size}px`;
    this.container.appendChild(planet);
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
    const mood = MOODS[this.mood] || MOODS.neutral;

    // Update time
    this.time += 1 / this.targetFPS;

    // Set uniforms
    gl.uniform1f(this.uniforms.uTime, this.time);
    gl.uniform1f(this.uniforms.uHue, mood.hue);
    gl.uniform1f(this.uniforms.uFlow, mood.flow);
    gl.uniform1f(this.uniforms.uDistort, mood.distort);
    gl.uniform1f(this.uniforms.uLuma, mood.luma);
    gl.uniform1f(this.uniforms.uBeat, this.beat * mood.beatAmt);

    // Clear and draw
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  setMood(newMood) {
    if (MOODS[newMood]) {
      this.mood = newMood;

      // Update CSS fallback colors
      if (!this.useWebGL && this.canvas) {
        const colors = MOODS[newMood].colors;
        this.canvas.style.background = `radial-gradient(circle, ${colors.primary}, ${colors.secondary})`;
      }
    }
  }

  setBeat(beatValue) {
    this.beat = Math.max(0, Math.min(1, beatValue));
  }

  setPlaying(playing) {
    this.isPlaying = playing;
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
