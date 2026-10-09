import type { Attribute } from '../../engine/types';

export interface Pal {
  main: string;
  light: string;
  dark: string;
  bg1: string;
  bg2: string;
  ink: string;
  /** 見出し帯の文字色。 */
  bandInk?: string;
}

const INK = '#33302b';

export const PALETTES: Record<Attribute | 'atk' | 'sup' | 'kosei', Pal> = {
  fire: { main: '#ef5a2a', light: '#ffb347', dark: '#b32d12', bg1: '#fff0dc', bg2: '#ffc79a', ink: INK },
  water: { main: '#3b82f6', light: '#a5d4ff', dark: '#1c4fb0', bg1: '#e4f3ff', bg2: '#a9d4ff', ink: INK },
  wood: { main: '#2fa862', light: '#b4e69a', dark: '#1a6b3c', bg1: '#e9f8da', bg2: '#b5e3a0', ink: INK },
  bolt: { main: '#f2b705', light: '#fff07a', dark: '#b57c00', bg1: '#fff8d4', bg2: '#ffe27a', ink: INK, bandInk: INK },
  dark: { main: '#7b5cf0', light: '#c8baff', dark: '#4527b0', bg1: '#ece4ff', bg2: '#bda8ff', ink: INK },
  atk: { main: '#e8503a', light: '#ffb7a2', dark: '#9c2a16', bg1: '#fff0e8', bg2: '#ffc9b6', ink: INK },
  sup: { main: '#1f9d63', light: '#aeeccd', dark: '#0f6a40', bg1: '#e6f9ef', bg2: '#b4e8cc', ink: INK },
  kosei: { main: '#7b5cf0', light: '#ffe08a', dark: '#4527b0', bg1: '#f6f0ff', bg2: '#d9c8ff', ink: INK },
};
