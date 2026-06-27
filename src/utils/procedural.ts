// Procedural Graphics and Audio Synthesizer Engine

// Draws a procedural video frame on a canvas 2D context at a given time (in seconds)
export function drawProceduralFrame(
  ctx: CanvasRenderingContext2D,
  type: 'grid' | 'stars' | 'plasma' | 'gradient' | 'waves' | 'matrix',
  time: number,
  width: number,
  height: number,
  params?: {
    speed?: number;
    color1?: string;
    color2?: string;
    density?: number;
  }
) {
  const speed = params?.speed ?? 1.0;
  const t = time * speed;
  const c1 = params?.color1 ?? '#ec4899'; // pink-500
  const c2 = params?.color2 ?? '#3b82f6'; // blue-500

  // Clear background
  ctx.fillStyle = '#0f172a'; // slate-900 default
  ctx.fillRect(0, 0, width, height);

  switch (type) {
    case 'grid': {
      // Retro Synthwave Grid
      // Draw background sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#050515');
      skyGrad.addColorStop(0.5, '#1e0530');
      skyGrad.addColorStop(1, '#050515');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Draw neon sun
      const sunY = height * 0.45;
      const sunRadius = Math.min(width, height) * 0.22;
      const sunGrad = ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY + sunRadius);
      sunGrad.addColorStop(0, '#facc15'); // yellow
      sunGrad.addColorStop(0.5, '#f43f5e'); // rose
      sunGrad.addColorStop(1, '#e11d48'); // rose-600
      ctx.beginPath();
      ctx.arc(width / 2, sunY, sunRadius, 0, Math.PI * 2);
      ctx.fillStyle = sunGrad;
      ctx.fill();

      // Sun stripes (retro scanlines)
      ctx.fillStyle = '#1e0530';
      const stripeHeight = 6;
      for (let y = sunY + 5; y < sunY + sunRadius; y += 14) {
        const stripeW = Math.sqrt(sunRadius * sunRadius - (y - sunY) * (y - sunY)) * 2;
        const progress = (y - sunY) / sunRadius;
        const thickness = stripeHeight * progress * 1.5;
        ctx.fillRect(width / 2 - stripeW / 2, y, stripeW, thickness);
      }

      // Draw perspective grid
      const horizonY = height * 0.55;
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 2;

      // Perspective lines
      const totalPerspectiveLines = 24;
      for (let i = 0; i <= totalPerspectiveLines; i++) {
        const ratio = i / totalPerspectiveLines;
        const xStart = width * ratio;
        const xEnd = width / 2 + (ratio - 0.5) * width * 5;
        ctx.beginPath();
        ctx.moveTo(xStart, horizonY);
        ctx.lineTo(xEnd, height);
        ctx.stroke();
      }

      // Scrolling horizontal lines
      const totalHorizontalLines = 15;
      const scroll = (t * 50) % 40; // speed of grid movement
      for (let i = 0; i < totalHorizontalLines; i++) {
        const lineVal = i / totalHorizontalLines;
        // Exponential spacing for perspective
        const yCoord = horizonY + Math.pow(lineVal, 1.8) * (height - horizonY) + scroll * (lineVal * 0.3);
        if (yCoord < height) {
          ctx.beginPath();
          ctx.moveTo(0, yCoord);
          ctx.lineTo(width, yCoord);
          ctx.lineWidth = 1 + lineVal * 2;
          ctx.strokeStyle = `rgba(236, 72, 153, ${0.15 + lineVal * 0.85})`;
          ctx.stroke();
        }
      }

      // Mountain contours on the horizon
      ctx.fillStyle = '#0f0518';
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      for (let x = 0; x <= width; x += 10) {
        const mountain1 = Math.sin(x * 0.015) * 35;
        const mountain2 = Math.cos(x * 0.005) * 20;
        const mountainY = horizonY - 15 + mountain1 + mountain2;
        ctx.lineTo(x, mountainY);
      }
      ctx.lineTo(width, horizonY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'stars': {
      // Cosmic Starfield
      ctx.fillStyle = '#020208';
      ctx.fillRect(0, 0, width, height);

      // Star density parameters
      const count = params?.density ?? 150;
      const maxZ = 1000;

      // Draw starry nebulae backdrop
      const radialGrad = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width * 0.7);
      radialGrad.addColorStop(0, 'rgba(88, 28, 135, 0.2)'); // Purple
      radialGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = radialGrad;
      ctx.fillRect(0, 0, width, height);

      // Procedural pseudo-random stars based on index, moving with time
      for (let i = 0; i < count; i++) {
        // Generate stable coordinates using sin of index
        const angle = Math.sin(i * 452.12) * Math.PI * 2;
        const speedMultiplier = 1.0 + Math.abs(Math.cos(i * 92.1) * 3);
        
        // Z distance decreases over time (flies closer)
        let z = (maxZ - (t * 150 * speedMultiplier + (i * 1234) % maxZ)) % maxZ;
        if (z < 0) z += maxZ;

        // Project 3D coordinates to 2D
        const px = (Math.cos(angle) * width * 0.8) / (z / maxZ);
        const py = (Math.sin(angle) * height * 0.8) / (z / maxZ);

        const x = width / 2 + px;
        const y = height / 2 + py;

        const size = (1.0 - z / maxZ) * 4;
        const opacity = (1.0 - z / maxZ);

        if (x >= 0 && x <= width && y >= 0 && y <= height) {
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();

          // Add a soft glow to closer stars
          if (size > 2.5) {
            ctx.fillStyle = `rgba(147, 197, 253, ${opacity * 0.3})`;
            ctx.beginPath();
            ctx.arc(x, y, size * 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Beautiful title subtitle box can be overlaid
      break;
    }

    case 'plasma': {
      // Math Plasma swirl
      // We perform a grid-sampled plasma to keep frame rate high
      const scale = 20;
      const cols = Math.ceil(width / scale);
      const rows = Math.ceil(height / scale);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const px = c * scale;
          const py = r * scale;

          const cx = px / width - 0.5;
          const cy = py / height - 0.5;

          // Compute complex wave patterns
          let val = Math.sin(cx * 4 + t);
          val += Math.sin(10 * (cx * Math.sin(t / 2) + cy * Math.cos(t / 3)) + t);
          const dist = Math.sqrt(cx * cx + cy * cy) * 3;
          val += Math.sin(dist - t * 2);

          // Map val [-3, 3] to color components
          const hue = Math.floor((val + 3) * 60) % 360;
          ctx.fillStyle = `hsla(${hue}, 80%, 35%, 1)`;
          ctx.fillRect(px, py, scale, scale);
        }
      }

      // Soft vignette
      const vig = ctx.createRadialGradient(width / 2, height / 2, width * 0.2, width / 2, height / 2, width * 0.7);
      vig.addColorStop(0, 'rgba(15, 23, 42, 0)');
      vig.addColorStop(1, 'rgba(15, 23, 42, 0.85)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
      break;
    }

    case 'gradient': {
      // Soft Liquid Gradient Blobs
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#1e1b4b'); // deep indigo
      grad.addColorStop(0.5, '#311042'); // deep purple
      grad.addColorStop(1, '#022c22'); // deep forest
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Create glowing drifting soft circles (using canvas composite operations)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      const blobs = [
        { x: width * 0.3 + Math.sin(t * 0.5) * width * 0.2, y: height * 0.4 + Math.cos(t * 0.3) * height * 0.2, r: width * 0.35, color: c1 },
        { x: width * 0.7 + Math.cos(t * 0.4) * width * 0.2, y: height * 0.6 + Math.sin(t * 0.6) * height * 0.2, r: width * 0.4, color: c2 },
        { x: width * 0.5 + Math.sin(t * 0.8) * width * 0.15, y: height * 0.3 + Math.sin(t * 0.2) * height * 0.15, r: width * 0.25, color: '#f43f5e' }
      ];

      blobs.forEach(b => {
        const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        rg.addColorStop(0, b.color);
        rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();

      // Ambient dust particles
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let i = 0; i < 20; i++) {
        const x = (Math.sin(i * 123 + t * 0.1) * 0.5 + 0.5) * width;
        const y = (Math.cos(i * 456 + t * 0.1) * 0.5 + 0.5) * height;
        const r = Math.sin(i * 789 + t) * 1.5 + 2.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'waves': {
      // Elegant overlapping mathematical wave crests
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#090514');
      skyGrad.addColorStop(1, '#1b0e2b');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Draw 3 layers of wavy curves
      const waveLayers = [
        { amplitude: 40, period: 0.003, speed: 1.2, color: 'rgba(59, 130, 246, 0.25)' }, // blue
        { amplitude: 30, period: 0.005, speed: -0.8, color: 'rgba(168, 85, 247, 0.3)' }, // purple
        { amplitude: 20, period: 0.007, speed: 2.0, color: 'rgba(236, 72, 153, 0.2)' }  // pink
      ];

      waveLayers.forEach((layer, idx) => {
        ctx.fillStyle = layer.color;
        ctx.beginPath();
        const baseLine = height * 0.6 + idx * 30;

        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 5) {
          const y = baseLine + Math.sin(x * layer.period + t * layer.speed) * layer.amplitude;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
      });

      // Overlay small glowing circles on key crests
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 5; i++) {
        const x = width * 0.2 * i + (t * 30) % (width * 0.2);
        const y = height * 0.65 + Math.sin(x * 0.004 + t) * 20;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'matrix': {
      // Matrix rain screen
      ctx.fillStyle = 'rgba(2, 6, 23, 1)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#10b981'; // emerald-500
      ctx.font = 'bold 15px monospace';

      const charSize = 18;
      const columns = Math.ceil(width / charSize);
      
      // We make it deterministic based on time and column index
      for (let col = 0; col < columns; col++) {
        // Stable pseudo-random phase for this column
        const columnOffset = (col * 312) % 1000;
        const columnSpeed = 0.5 + Math.abs(Math.sin(col * 83.2) * 1.5);
        const fallProgress = (t * 120 * columnSpeed + columnOffset) % (height + 200);
        
        const leadingY = Math.floor(fallProgress / charSize) * charSize;

        // Draw a trail of characters above the leading one
        const trailLen = 12;
        for (let i = 0; i < trailLen; i++) {
          const charY = leadingY - i * charSize;
          if (charY >= 0 && charY < height) {
            // Pick a pseudo-random Matrix glyph
            const charCode = 33 + ((col * 17 + i * 13 + Math.floor(t * 2)) % 93);
            const glyph = String.fromCharCode(charCode);
            
            // Fade out the trail
            const opacity = 1.0 - i / trailLen;
            ctx.fillStyle = i === 0 
              ? `rgba(255, 255, 255, ${opacity})` // Bright white head
              : `rgba(16, 185, 129, ${opacity * 0.8})`; // Green trail

            ctx.fillText(glyph, col * charSize, charY);
          }
        }
      }
      break;
    }
  }
}

// ----------------------------------------------------------------------
// Procedural Web Audio API sound generator for preview playback
// ----------------------------------------------------------------------

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
}

export class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeVoices: Voice[] = [];
  private currentLoop: 'lofi' | 'techno' | 'ambient' | 'none' = 'none';
  private lastBeatTime: number = 0;
  private beatInterval: number = 0.5; // BPM based (0.5s = 120BPM)
  private beatCount: number = 0;
  private schedulerTimer: number | null = null;

  constructor() {}

  public init() {
    if (!this.ctx) {
      // Initialize browser audio context safely
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (!this.masterGain && this.ctx) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(volume: number) {
    this.init();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
    }
  }

  public setLoop(type: 'lofi' | 'techno' | 'ambient' | 'none') {
    this.init();
    if (this.currentLoop === type) return;

    this.stop();
    this.currentLoop = type;
    
    if (type !== 'none') {
      this.beatInterval = type === 'techno' ? 0.46 : type === 'lofi' ? 0.75 : 1.5;
      this.beatCount = 0;
      this.lastBeatTime = this.ctx!.currentTime;
      this.startScheduler();
    }
  }

  public stop() {
    if (this.schedulerTimer) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.activeVoices.forEach(v => {
      try { v.osc.stop(); } catch (e) {}
    });
    this.activeVoices = [];
    this.currentLoop = 'none';
  }

  private startScheduler() {
    this.schedulerTimer = window.setInterval(() => {
      if (!this.ctx) return;
      const lookahead = 0.15; // 150ms lookahead
      const now = this.ctx.currentTime;

      while (this.lastBeatTime < now + lookahead) {
        this.scheduleBeat(this.beatCount, this.lastBeatTime);
        this.lastBeatTime += this.beatInterval;
        this.beatCount = (this.beatCount + 1) % 16;
      }
    }, 50) as any;
  }

  private scheduleBeat(step: number, time: number) {
    if (!this.ctx) return;

    if (this.currentLoop === 'techno') {
      // Four-to-the-floor kick drum on steps 0, 4, 8, 12
      if (step % 4 === 0) {
        this.triggerSynthKick(time);
      }
      // Rhythmic snare on 4, 12
      if (step % 8 === 4) {
        this.triggerSynthSnare(time, 0.12);
      }
      // Hi-hat on every step, accented on offbeats
      const hatVolume = step % 2 === 1 ? 0.08 : 0.02;
      this.triggerSynthHihat(time, hatVolume);

      // Acid bassline notes (16th step feel)
      const bassNotes = [55, 55, 65.4, 55, 73.4, 55, 65.4, 82.4, 55, 55, 65.4, 55, 51.9, 58.2, 55, 65.4];
      const hz = bassNotes[step];
      this.triggerAcidBass(hz, time, this.beatInterval * 0.4);

    } else if (this.currentLoop === 'lofi') {
      // Relaxed drum beat
      if (step % 8 === 0 || step % 8 === 6) {
        this.triggerSynthKick(time, 0.4);
      }
      if (step % 8 === 4) {
        this.triggerSynthSnare(time, 0.08, 0.01, 0.25);
      }
      // Soft hat
      if (step % 2 === 1) {
        this.triggerSynthHihat(time, 0.03, 0.05);
      }

      // Vinyl crackle simulator occasionally
      if (Math.random() < 0.3) {
        this.triggerCrackle(time);
      }

      // Jazz chords progression
      // Am7 -> D7 -> Gmaj7 -> Cmaj7
      if (step === 0) {
        this.triggerSoftChord([220, 261.6, 329.6, 392], time, this.beatInterval * 3.8); // Am7
      } else if (step === 4) {
        this.triggerSoftChord([293.7, 349.2, 440, 523.3], time, this.beatInterval * 3.8); // D7
      } else if (step === 8) {
        this.triggerSoftChord([196, 246.9, 293.7, 392], time, this.beatInterval * 3.8); // Gmaj7
      } else if (step === 12) {
        this.triggerSoftChord([261.6, 329.6, 392, 493.9], time, this.beatInterval * 3.8); // Cmaj7
      }

    } else if (this.currentLoop === 'ambient') {
      // Ambient slow pad chord (steps 0 and 8)
      if (step === 0) {
        this.triggerSoftChord([130.8, 164.8, 196, 293.7, 329.6], time, this.beatInterval * 7.5, 0.08); // Cmaj9 deep
      } else if (step === 8) {
        this.triggerSoftChord([146.8, 174.6, 220, 293.7, 349.2], time, this.beatInterval * 7.5, 0.08); // Dm11 deep
      }
      
      // Occasional random high twinkle notes
      if (Math.random() < 0.4) {
        const notes = [523.3, 587.3, 659.3, 784, 880, 1046.5];
        const note = notes[Math.floor(Math.random() * notes.length)];
        this.triggerSoftPluck(note, time, 0.02);
      }
    }
  }

  // Synthesizes a deep kick drum
  private triggerSynthKick(time: number, maxVol = 0.5) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);

    osc.frequency.setValueAtTime(150, time);
    // Exponential sweep down for thud
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.15);

    gain.gain.setValueAtTime(maxVol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  // Synthesizes white-noise snare
  private triggerSynthSnare(time: number, volume: number, attack = 0.01, decay = 0.15) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * decay;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Populate with noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);

    noiseNode.start(time);
    noiseNode.stop(time + decay + 0.05);
  }

  // Synthesizes high pass filtered hi-hat ticks
  private triggerSynthHihat(time: number, volume: number, decay = 0.04) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(10000, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);

    osc.start(time);
    osc.stop(time + decay);
  }

  // Synthesizes retro acid synth wave
  private triggerAcidBass(hz: number, time: number, duration: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(hz, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, time);
    filter.frequency.exponentialRampToValueAtTime(1200, time + 0.05);
    filter.frequency.exponentialRampToValueAtTime(200, time + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.linearRampToValueAtTime(0.06, time + duration * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  // Soft synth chord progression
  private triggerSoftChord(frequencies: number[], time: number, duration: number, volume = 0.06) {
    if (!this.ctx) return;
    const mergerGain = this.ctx.createGain();
    mergerGain.gain.setValueAtTime(0, time);
    mergerGain.gain.linearRampToValueAtTime(volume, time + 0.3); // Soft attack
    mergerGain.gain.linearRampToValueAtTime(volume * 0.8, time + duration - 0.4);
    mergerGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    mergerGain.connect(this.masterGain || this.ctx.destination);

    frequencies.forEach(f => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine'; // Super warm smooth sine waves
      osc.frequency.setValueAtTime(f, time);

      osc.connect(mergerGain);
      osc.start(time);
      osc.stop(time + duration + 0.1);
    });
  }

  // Twinkling high pluck synth note
  private triggerSoftPluck(hz: number, time: number, volume = 0.04) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz, time);

    const delay = this.ctx.createDelay();
    delay.delayTime.setValueAtTime(0.15, time);

    const delayGain = this.ctx.createGain();
    delayGain.gain.setValueAtTime(0.3, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);

    osc.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);

    // Feedback delay loop
    gain.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(delay);
    delayGain.connect(this.masterGain || this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.9);
  }

  // Record crackle noise
  private triggerCrackle(time: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(50, time);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 5000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.005, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.03);
  }
}
