/**
 * useSounds — Web Audio API sound effects for Jungle Crash.
 * No external files needed: all sounds are generated procedurally.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext();
  }
  return ctx;
}

/** Resumes the AudioContext (required after user gesture). */
function resume() {
  const c = getCtx();
  if (c.state === 'suspended') c.resume();
}

// ─── Sound generators ────────────────────────────────────────────────────────

/** Short upward blip — bet placed. */
function playBetSound() {
  resume();
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, c.currentTime);
  osc.frequency.linearRampToValueAtTime(660, c.currentTime + 0.08);
  gain.gain.setValueAtTime(0.25, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.15);
}

/** Ascending chime — cashout success. */
function playCashoutSound() {
  resume();
  const c = getCtx();
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = 'sine';
    const t = c.currentTime + i * 0.07;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.start(t);
    osc.stop(t + 0.25);
  });
}

/** Descending buzz + noise burst — crash. */
function playCrashSound() {
  resume();
  const c = getCtx();

  // Descending sawtooth
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.4);
  gain.gain.setValueAtTime(0.3, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.5);

  // White noise burst
  const bufLen = c.sampleRate * 0.3;
  const buffer = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = c.createGain();
  noise.connect(noiseGain);
  noiseGain.connect(c.destination);
  noiseGain.gain.setValueAtTime(0.15, c.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
  noise.start(c.currentTime);
}

/** Tick sound during multiplier rise (subtle) — called on multiplier ticks. */
function playTickSound(multiplier: number) {
  // Only tick at certain thresholds to avoid spam
  if (multiplier < 1.5) return;
  if (multiplier < 2 && Math.random() > 0.05) return;
  if (multiplier < 5 && Math.random() > 0.15) return;
  if (Math.random() > 0.3) return;

  resume();
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = 'sine';
  // Pitch rises with multiplier
  const freq = Math.min(200 + multiplier * 30, 800);
  osc.frequency.setValueAtTime(freq, c.currentTime);
  gain.gain.setValueAtTime(0.04, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.05);
}

export function useSounds() {
  return { playBetSound, playCashoutSound, playCrashSound, playTickSound };
}
