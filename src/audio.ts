// ── Synthesized sound effects using Web Audio API ───────────

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function resumeAudio(): void {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.15): void {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available
  }
}

function playNoise(duration: number, volume: number = 0.08): void {
  try {
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch {
    // Audio not available
  }
}

export function playCardPlace(): void {
  playTone(220, 0.1, 'triangle', 0.1);
  playNoise(0.06, 0.05);
}

export function playCardFlip(): void {
  playNoise(0.08, 0.06);
  playTone(440, 0.08, 'sine', 0.06);
}

export function playCardDraw(): void {
  playNoise(0.05, 0.04);
}

export function playShuffle(): void {
  for (let i = 0; i < 5; i++) {
    setTimeout(() => playNoise(0.04, 0.03), i * 40);
  }
}

export function playWin(): void {
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.3, 'sine', 0.12), i * 150);
  });
}

export function playLose(): void {
  playTone(200, 0.5, 'sawtooth', 0.08);
  setTimeout(() => playTone(150, 0.6, 'sawtooth', 0.06), 200);
}

export function playUndo(): void {
  playTone(330, 0.1, 'triangle', 0.08);
}

export function playClick(): void {
  playTone(600, 0.05, 'sine', 0.06);
}
