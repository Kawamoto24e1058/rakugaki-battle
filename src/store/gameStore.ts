import { create } from 'zustand';
import type { Character } from '../engine/types';
import type { AnalyzeResult } from '../engine/analyze';
import { makeCpuRoster } from '../data/cpuRoster';
import { loadZukan, saveZukan } from './zukan';
import { saveDrawing } from './drawings';
import { npcImage } from '../components/art/npcArt';

export type Screen =
  | 'title'
  | 'print'
  | 'badge'
  | 'capture'
  | 'reveal'
  | 'opponent'
  | 'battle'
  | 'result'
  | 'zukan'
  | 'cards';

export type Mode = 'solo' | 'versus';

interface CapturedSlot {
  character: Character;
  imageUrl: string | null;
  analysis: AnalyzeResult;
  /** 解析方法。'ai' = Gemini、'local' = ピクセル解析フォールバック。 */
  analyzedBy?: 'ai' | 'local';
  /** 技えらびで えらんだ 技（回ごと。まだなら null）。 */
  movePicks?: (string | null)[];
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
  /** さいごの バトルが ひきわけ だったか。 */
  lastDraw: boolean;

  zukan: Character[];
  cpuRoster: Character[];

  // --- actions ---
  reset: () => void;
  startSolo: () => void;
  startVersus: () => void;
  openZukan: () => void;
  openPrintTemplate: () => void;
  openCards: () => void;
  openBadges: () => void;
  devQuickBattle: (mode: Mode) => void;
  setCaptured: (slot: CapturedSlot) => void;
  /** リビール画面で名前を手直しする。 */
  renamePlayer: (name: string) => void;
  /** 技えらび：round 回めの 技を えらぶ（moveRounds の なかから）。null で えらびなおし（ぜんぶ）。 */
  chooseMove: (round: number | null, id?: string) => void;
  confirmReveal: () => void;
  chooseCpu: (character: Character) => void;
  finishBattle: (won: boolean, draw?: boolean) => void;
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
  lastDraw: false,
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
      lastDraw: false,
    }),

  startSolo: () =>
    set({ mode: 'solo', screen: 'capture', player: null, pendingChallenger: null, runWins: 0, runBattles: 0 }),
  startVersus: () =>
    set({ mode: 'versus', screen: 'capture', player: null, pendingChallenger: null, runWins: 0, runBattles: 0 }),

  openZukan: () => set({ screen: 'zukan', zukan: loadZukan() }),
  openPrintTemplate: () => set({ screen: 'print' }),
  openCards: () => set({ screen: 'cards' }),
  openBadges: () => set({ screen: 'badge' }),

  devQuickBattle: (mode) => {
    const roster = get().cpuRoster;
    const [a, b] = [roster[0], roster[3]];
    set({
      mode,
      player: { character: a, imageUrl: npcImage(a.id), analysis: { character: a } as unknown as AnalyzeResult },
      opponent: { character: b, imageUrl: npcImage(b.id), isCpu: mode === 'solo' },
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

  chooseMove: (round, id) => {
    const { player } = get();
    if (!player) return;
    const c = player.character;
    const rounds = c.moveRounds ?? [];
    if (round == null) {
      set({ player: { ...player, movePicks: rounds.map(() => null) } });
      return;
    }
    const opt = rounds[round]?.options.find((x) => x.id === id);
    if (!opt) return;
    const picks = [...(player.movePicks ?? rounds.map(() => null))];
    picks[round] = opt.id;
    const moveIds = [...c.moveIds];
    const moveReasons = [...(c.moveReasons ?? c.moveIds.map(() => ''))];
    moveIds[round] = opt.id;
    moveReasons[round] = opt.reason;
    set({ player: { ...player, character: { ...c, moveIds, moveReasons }, movePicks: picks } });
  },

  confirmReveal: () => {
    const { mode, player, pendingChallenger } = get();
    // 缶バッジ印刷で えらべるように 絵を のこす（名前が きまった あと）
    if (player?.imageUrl) {
      const c = player.character;
      void saveDrawing({ id: c.id, name: c.name, attribute: c.attribute, image: player.imageUrl, createdAt: Date.now() });
    }
    if (mode === 'versus') {
      if (!pendingChallenger) {
        // 1人目 → 保持して2人目の撮影へ
        set({ pendingChallenger: player, player: null, screen: 'capture' });
      } else {
        // 2人目まで揃った → 対戦
        set({
          opponent: {
            character: pendingChallenger.character,
            imageUrl: pendingChallenger.imageUrl,
            isCpu: false,
          },
          screen: 'battle',
        });
      }
    } else {
      set({ screen: 'opponent' });
    }
  },

  chooseCpu: (character) =>
    set({ opponent: { character, imageUrl: npcImage(character.id), isCpu: true }, screen: 'battle' }),

  finishBattle: (won, draw = false) => {
    // キャラは強化しない・記録も変えない。勝敗数はセッション内のカウントだけ。
    set((s) => ({
      lastWon: won,
      lastDraw: draw,
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
