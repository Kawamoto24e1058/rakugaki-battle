/**
 * 効果音（外部ファイルなしの WebAudio 合成）。最初のタップ以降に鳴る。
 * 展示用に音を消せるよう、ON/OFF を localStorage に覚える。
 */
const KEY = 'rakugaki.sound';
/** 全体の音量（展示で うるさくならないよう控えめ）。 */
const MASTER = 0.5;
let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem(KEY) === 'off';
} catch {
  /* ストレージが使えなくても続行 */
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new C();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol * MASTER, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol: number, from: number, to: number, delay = 0): void {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol * MASTER, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
}

export const sfx = {
  isMuted: () => muted,
  setMuted(v: boolean) {
    muted = v;
    try {
      localStorage.setItem(KEY, v ? 'off' : 'on');
    } catch {
      /* noop */
    }
  },
  deal(i: number) {
    noise(0.07, 0.12, 5000, 1500, i * 0.22);
    tone(520 + i * 70, 0.07, 'triangle', 0.05, undefined, i * 0.22 + 0.04);
  },
  select() {
    tone(620, 0.08, 'square', 0.05);
  },
  confirm() {
    tone(440, 0.07, 'square', 0.06);
    tone(740, 0.12, 'square', 0.06, undefined, 0.07);
  },
  order() {
    noise(0.5, 0.14, 300, 4500);
  },
  callout() {
    tone(330, 0.06, 'square', 0.05);
    tone(495, 0.1, 'square', 0.05, undefined, 0.05);
  },
  hit(power = 0.5, crit = false) {
    noise(0.1 + power * 0.2, 0.22 + power * 0.18, 2400, 160);
    tone(150 + (1 - power) * 80, 0.16 + power * 0.1, 'sawtooth', 0.14 + power * 0.1, 50);
    if (crit) {
      tone(880, 0.16, 'square', 0.08, 1320);
      tone(1320, 0.2, 'triangle', 0.07, undefined, 0.08);
    }
  },
  heal() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'sine', 0.07, undefined, i * 0.08));
  },
  buff() {
    tone(330, 0.3, 'triangle', 0.07, 880);
  },
  debuff() {
    tone(520, 0.3, 'sawtooth', 0.06, 160);
  },
  guard() {
    tone(260, 0.1, 'square', 0.07);
    noise(0.1, 0.1, 1800, 500);
  },
  charge() {
    tone(160, 0.9, 'sawtooth', 0.07, 760);
  },
  release() {
    noise(0.55, 0.4, 3000, 80);
    tone(90, 0.5, 'sawtooth', 0.22, 35);
  },
  status() {
    tone(420, 0.12, 'square', 0.05, 280);
    tone(330, 0.14, 'square', 0.05, 220, 0.1);
  },
  ko() {
    tone(500, 0.6, 'triangle', 0.1, 70);
  },
  win() {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.08, undefined, i * 0.12));
  },
};
