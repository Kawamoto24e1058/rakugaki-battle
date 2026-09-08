import { create } from 'zustand';
import type { Character } from '../engine/types';
import type { AnalyzeResult } from '../engine/analyze';
import { makeCpuRoster } from '../data/cpuRoster';
import { loadZukan, saveZukan } from './zukan';

export type Screen =
  | 'title'
  | 'capture'
  | 'reveal'
  | 'loadout'
  | 'opponent'
  | 'battle'
  | 'result'
  | 'zukan';

export type Mode = 'solo' | 'versus';

interface CapturedSlot {
  character: Character;
  imageUrl: string | null;
  analysis: AnalyzeResult;
  /** 解析方法。'ai' = Gemini、'local' = ピクセル解析フォールバック。 */
  analyzedBy?: 'ai' | 'local';
}

interface GameState {
  screen: Screen;
  mode: Mode;

  /** いま育成中／操作中のキャラ（左側）。 */
  player: CapturedSlot | null;
  /** 対戦相手（右側）。CPUまたは2人目の絵。 */
  opponent: { character: Character; imageUrl: string | null; isCpu: boolean } | null;

  /** versus用：1人目を保持しておく箱。 */
  pendingChallenger: CapturedSlot | null;

  runWins: number;
  runBattles: number;
  lastWon: boolean | null;

  zukan: Character[];
  cpuRoster: Character[];

  // --- actions ---
  reset: () => void;
  startSolo: () => void;
  startVersus: () => void;
  openZukan: () => void;
  devQuickBattle: (mode: Mode) => void;
  setCaptured: (slot: CapturedSlot) => void;
  /** リビール画面で名前を手直しする。 */
  renamePlayer: (name: string) => void;
  confirmReveal: () => void;
  /** 編成画面で技セットを決めて次へ進む。 */
  confirmLoadout: (moveIds: string[]) => void;
  chooseCpu: (character: Character) => void;
  finishBattle: (won: boolean) => void;
  nextRound: () => void;
  savePlayerToZukan: () => void;
}

export const useGame = create<GameState>((set, get) => ({
  screen: 'title',
  mode: 'solo',
  player: null,
  opponent: null,
  pendingChallenger: null,
  runWins: 0,
  runBattles: 0,
  lastWon: null,
  zukan: loadZukan(),
  cpuRoster: makeCpuRoster(),

  reset: () =>
    set({
      screen: 'title',
      player: null,
      opponent: null,
      pendingChallenger: null,
      runWins: 0,
      runBattles: 0,
      lastWon: null,
    }),

  startSolo: () =>
    set({ mode: 'solo', screen: 'capture', player: null, pendingChallenger: null, runWins: 0, runBattles: 0 }),
  startVersus: () =>
    set({ mode: 'versus', screen: 'capture', player: null, pendingChallenger: null, runWins: 0, runBattles: 0 }),

  openZukan: () => set({ screen: 'zukan', zukan: loadZukan() }),

  devQuickBattle: (mode) => {
    const roster = get().cpuRoster;
    const [a, b] = [roster[0], roster[3]];
    set({
      mode,
      player: { character: a, imageUrl: null, analysis: { character: a } as unknown as AnalyzeResult },
      opponent: { character: b, imageUrl: null, isCpu: mode === 'solo' },
      runWins: 0,
      screen: 'battle',
    });
  },

  setCaptured: (slot) => set({ player: slot, screen: 'reveal' }),

  renamePlayer: (name) => {
    const { player } = get();
    if (!player) return;
    const trimmed = name.trim().slice(0, 12);
    if (!trimmed || trimmed === player.character.name) return;
    set({ player: { ...player, character: { ...player.character, name: trimmed } } });
  },

  confirmReveal: () => set({ screen: 'loadout' }),

  confirmLoadout: (moveIds) => {
    const { mode, player, pendingChallenger } = get();
    const p =
      player && moveIds.length > 0
        ? { ...player, character: { ...player.character, moveIds: [...moveIds] } }
        : player;
    if (mode === 'versus') {
      if (!pendingChallenger) {
        // 1人目 → 保持して2人目の撮影へ
        set({ pendingChallenger: p, player: null, screen: 'capture' });
      } else {
        // 2人目まで揃った → 対戦
        set({
          player: p,
          opponent: {
            character: pendingChallenger.character,
            imageUrl: pendingChallenger.imageUrl,
            isCpu: false,
          },
          screen: 'battle',
        });
      }
    } else {
      set({ player: p, screen: 'opponent' });
    }
  },

  chooseCpu: (character) =>
    set({ opponent: { character, imageUrl: null, isCpu: true }, screen: 'battle' }),

  finishBattle: (won) => {
    // キャラは強化しない・記録も変えない。勝敗数はセッション内のカウントだけ。
    set((s) => ({
      lastWon: won,
      runWins: won ? s.runWins + 1 : s.runWins,
      runBattles: s.runBattles + 1,
      screen: 'result',
    }));
  },

  nextRound: () => set({ screen: 'opponent', opponent: null }),

  savePlayerToZukan: () => {
    const { player, zukan } = get();
    if (!player) return;
    const next = [player.character, ...zukan.filter((c) => c.id !== player.character.id)].slice(0, 200);
    saveZukan(next);
    set({ zukan: next });
  },
}));
