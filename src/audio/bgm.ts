import { audioContext, onMuteChange, sfx } from './sfx';

/**
 * BGM（外部ファイルなし。WebAudio で その場で 鳴らす 8bit 風の 曲）。
 *  home：タイトル・撮影・キャラ紹介（あかるく ゆったり）
 *  battle：バトル（はやく かっこよく。ピンチで すこし はやくなる）
 *  win／lose：結果の ジングル（1回だけ）
 * 「おと：OFF」で とまり、ON で つづきから。ブラウザの きまりで 最初に 画面を おしてから 鳴る。
 */
export type SongId = 'home' | 'battle';
export type JingleId = 'win' | 'lose';

/** 音量（効果音より ひかえめ）。 */
const VOL = 0.16;

/** 8分音符の ならび。'-'＝のばす、'.'＝やすみ。 */
type Bar = string;
interface Song {
  bpm: number;
  /** 1小節ごとの コード（ベースと アルペジオの 根音）。 */
  chords: string[];
  melody: Bar[];
  drums: 'calm' | 'drive';
}

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
/** 'E5' → MIDI 番号。 */
function midi(n: string): number {
  const m = /^([A-G]#?)(\d)$/.exec(n);
  if (!m) return 60;
  return NOTE[m[1]] + (Number(m[2]) + 1) * 12;
}
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** コード名 → 構成音（MIDI。根音は 3オクターブめ）。 */
function chordTones(c: string): number[] {
  const minor = c.endsWith('m');
  const root = midi(`${minor ? c.slice(0, -1) : c}3`);
  return [root, root + (minor ? 3 : 4), root + 7];
}

const SONGS: Record<SongId, Song> = {
  home: {
    bpm: 112,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'],
    melody: [
      'E5 G5 C6 G5 A5 G5 E5 -',
      'C5 E5 A5 E5 G5 E5 C5 -',
      'F5 A5 C6 A5 D6 C6 A5 -',
      'G5 - B5 - D6 - B5 G5',
      'E5 - G5 E5 C6 - G5 -',
      'A5 G5 E5 C5 D5 E5 - .',
      'F5 - A5 - G5 F5 E5 D5',
      'G5 - - - . . . .',
    ],
    drums: 'calm',
  },
  battle: {
    bpm: 148,
    chords: ['Am', 'F', 'G', 'E', 'Am', 'F', 'G', 'E'],
    melody: [
      'A4 . A4 C5 E5 - D5 C5',
      'F4 . F4 A4 C5 - B4 A4',
      'G4 . G4 B4 D5 - C5 B4',
      'E5 - B4 - G#4 - B4 -',
      'A5 - E5 - C5 E5 A5 -',
      'C6 - A5 - F5 A5 C6 -',
      'B5 - G5 - D5 G5 B5 D6',
      'E6 - - - E5 . . .',
    ],
    drums: 'drive',
  },
};

let current: SongId | null = null;
let timer = 0;
let nextTime = 0;
let step = 0; // 16分音符で かぞえる
let tempoScale = 1;
let bus: GainNode | null = null;

function out(c: AudioContext): GainNode {
  if (!bus || bus.context !== c) {
    bus = c.createGain();
    bus.gain.value = VOL;
    bus.connect(c.destination);
  }
  return bus;
}

function note(c: AudioContext, freq: number, t: number, dur: number, type: OscillatorType, vol: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.setValueAtTime(vol, t + Math.max(0.02, dur * 0.7));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out(c));
  o.start(t);
  o.stop(t + dur + 0.02);
}

function drum(c: AudioContext, kind: 'kick' | 'snare' | 'hat', t: number) {
  if (kind === 'kick') {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(out(c));
    o.start(t);
    o.stop(t + 0.16);
    return;
  }
  const dur = kind === 'snare' ? 0.12 : 0.04;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = kind === 'snare' ? 'bandpass' : 'highpass';
  f.frequency.value = kind === 'snare' ? 1800 : 7000;
  const g = c.createGain();
  g.gain.setValueAtTime(kind === 'snare' ? 0.5 : 0.18, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out(c));
  src.start(t);
}

/** 1つの 16分音符ぶんを ならす。 */
function playStep(c: AudioContext, song: Song, s: number, t: number, sixteenth: number) {
  const bars = song.melody.length;
  const bar = Math.floor(s / 16) % bars;
  const inBar = s % 16;
  // メロディ（8分音符ごと）
  if (inBar % 2 === 0) {
    const toks = song.melody[bar].split(/\s+/);
    const i = inBar / 2;
    const tok = toks[i];
    if (tok && tok !== '-' && tok !== '.') {
      let len = 1;
      while (toks[i + len] === '-') len++;
      note(c, hz(midi(tok)), t, len * sixteenth * 2 * 0.95, 'square', 0.32);
    }
  }
  // ベース（8分音符。根音と オクターブ）
  const tones = chordTones(song.chords[bar]);
  if (inBar % 2 === 0) {
    const root = tones[0] - 12;
    const r = song.drums === 'drive' ? (inBar % 4 === 2 ? root + 12 : root) : inBar % 8 === 0 ? root : inBar % 8 === 4 ? root + 7 : null;
    if (r != null) note(c, hz(r), t, sixteenth * (song.drums === 'drive' ? 1.8 : 3.6), 'triangle', 0.55);
  }
  // アルペジオ（16分音符。ちいさく）
  if (song.drums === 'drive' || inBar % 2 === 0) {
    const arp = tones[(inBar >> (song.drums === 'drive' ? 0 : 1)) % 3] + 12;
    note(c, hz(arp), t, sixteenth * 0.9, 'square', 0.07);
  }
  // ドラム
  if (song.drums === 'calm') {
    if (inBar === 0 || inBar === 8) drum(c, 'kick', t);
    if (inBar === 4 || inBar === 12) drum(c, 'snare', t);
    if (inBar % 4 === 2) drum(c, 'hat', t);
  } else {
    if (inBar === 0 || inBar === 6 || inBar === 8 || inBar === 11) drum(c, 'kick', t);
    if (inBar === 4 || inBar === 12) drum(c, 'snare', t);
    if (inBar % 2 === 1) drum(c, 'hat', t);
  }
}

function tick() {
  if (!current) return;
  const c = audioContext();
  if (!c || c.state !== 'running') return;
  const song = SONGS[current];
  const sixteenth = 60 / (song.bpm * tempoScale) / 4;
  if (nextTime < c.currentTime) nextTime = c.currentTime + 0.05;
  // 0.15びょう 先まで 予約する
  while (nextTime < c.currentTime + 0.15) {
    playStep(c, song, step, nextTime, sixteenth);
    step++;
    nextTime += sixteenth;
  }
}

function startTimer() {
  if (timer) return;
  timer = window.setInterval(tick, 30);
}
function stopTimer() {
  window.clearInterval(timer);
  timer = 0;
}

// ブラウザの きまり：さいしょに 画面を おしたら 音を はじめる
let unlocked = false;
function unlock() {
  if (unlocked) return;
  unlocked = true;
  audioContext();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

onMuteChange((m) => {
  if (m) stopTimer();
  else if (current) {
    nextTime = 0;
    startTimer();
  }
});

export const bgm = {
  /** 曲を かける（おなじ 曲なら そのまま）。 */
  play(id: SongId | null) {
    if (id === current) return;
    current = id;
    step = 0;
    nextTime = 0;
    tempoScale = 1;
    if (!id) {
      stopTimer();
      return;
    }
    if (!sfx.isMuted()) startTimer();
  },
  /** テンポの 倍率（ピンチで はやく）。 */
  setTempo(scale: number) {
    tempoScale = scale;
  },
  /** ジングルを 1回（いまの 曲は とめる）。 */
  jingle(id: JingleId) {
    bgm.play(null);
    const c = audioContext();
    if (!c) return;
    const t0 = c.currentTime + 0.05;
    const seq: [string, number, number][] =
      id === 'win'
        ? [['C5', 0, 0.12], ['E5', 0.12, 0.12], ['G5', 0.24, 0.12], ['C6', 0.36, 0.3], ['G5', 0.7, 0.12], ['C6', 0.84, 0.9]]
        : [['G4', 0, 0.35], ['F4', 0.4, 0.35], ['E4', 0.8, 0.35], ['D4', 1.2, 0.35], ['C4', 1.6, 0.9]];
    for (const [n, at, len] of seq) {
      note(c, hz(midi(n)), t0 + at, len, id === 'win' ? 'square' : 'triangle', 0.4);
      if (id === 'win') note(c, hz(midi(n) - 12), t0 + at, len, 'triangle', 0.35);
    }
  },
};
