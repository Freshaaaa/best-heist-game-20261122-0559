// VELVET VAULT — audio.js
// All sound is synthesized with WebAudio: no audio files, nothing fetched.
// Created lazily on the first user gesture (autoplay policy); every call
// before that is a silent no-op.
let ctx = null;
let alarmNodes = null;

export function ensureAudio() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  } catch (e) { ctx = null; }
}

function tone(freq, dur, type, vol, when, slideTo) {
  if (!ctx) return;
  const t0 = ctx.currentTime + (when || 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// Soft footstep tick while Wren walks (called by main.js on step distance).
export function playStep(sneaking) {
  if (!ctx) return;
  tone(sneaking ? 140 : 190, 0.05, 'triangle', sneaking ? 0.02 : 0.045);
}

// Two-note chime when loot is lifted.
export function playPickup() {
  tone(660, 0.12, 'sine', 0.14);
  tone(990, 0.22, 'sine', 0.14, 0.09);
}

// EMP burst: a downward zap.
export function playEmp() {
  tone(1200, 0.28, 'sawtooth', 0.08, 0, 180);
}

// Smoke puff: filtered noise burst (approximated with a low thump).
export function playSmoke() {
  tone(220, 0.3, 'sine', 0.1, 0, 60);
}

// Lockpick click.
export function playLockpick() {
  tone(1500, 0.05, 'square', 0.05);
  tone(1900, 0.05, 'square', 0.05, 0.07);
}

// A guard spots Wren: a short warning sting.
export function playSpotted() {
  tone(520, 0.14, 'square', 0.09);
  tone(392, 0.2, 'square', 0.09, 0.12);
}

// Caught: low descending buzz.
export function playCaught() {
  tone(220, 0.7, 'sawtooth', 0.14, 0, 55);
}

// Win: a little four-note arpeggio.
export function playWin() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, 'sine', 0.13, i * 0.11));
}

// Alarm loop while the alarm meter is high; call with a level 0..1 each
// frame (0 stops it). Implemented as a repeating two-tone wail.
export function setAlarmLevel(level) {
  if (!ctx) return;
  if (level <= 0.02) {
    if (alarmNodes) { try { alarmNodes.stop(); } catch (e) {} alarmNodes = null; }
    return;
  }
  if (alarmNodes) return; // already wailing
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 620;
  lfo.type = 'sine';
  lfo.frequency.value = 1.6;
  lfoGain.gain.value = 180;
  gain.gain.value = 0.035 + 0.03 * level;
  lfo.connect(lfoGain).connect(osc.frequency);
  osc.connect(gain).connect(ctx.destination);
  osc.start(); lfo.start();
  alarmNodes = {
    stop() { try { osc.stop(); lfo.stop(); } catch (e) {} },
  };
}
