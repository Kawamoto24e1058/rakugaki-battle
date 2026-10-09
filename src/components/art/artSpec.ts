import type { Cond, MoveDef } from '../../engine/moves';
import type { Pal } from './palette';
import { PALETTES } from './palette';

/** カードのイラスト指定。モチーフ名（'名前' か '名前:x,y,倍率,回転'）を並べる。 */
export interface ArtSpec {
  pal: Pal;
  motifs: string[];
  /** 先に うごく（スピード線）。 */
  quick: boolean;
  /** ため技（まわりに ためのリング）。 */
  charge: boolean;
  /** 条件つき技のリボン文字。 */
  ribbon: string | null;
  /** 手札いじり（カードの小バッジ）。 */
  hand: boolean;
  /** こうげき系か（背景のスタイル）。 */
  attack: boolean;
}

const CARD_MOTIFS: Record<string, string[]> = {
  // ふつう
  c_scratch: ['claw'],
  c_tackle: ['rush'],
  c_bite: ['bite'],
  c_headbutt: ['horn', 'burst:128,26,.5,0'],
  c_twin: ['claw', 'claw:128,28,.5,18'],
  c_rush: ['rush', 'burst:128,26,.5,0'],
  c_onetwo: ['fist', 'burst:128,24,.45,0'],
  c_counterpunch: ['fist:62,54,.9,0', 'counter:118,44,.8,0'],
  c_desperate: ['fist', 'crit:128,26,.5,0'],
  c_foresight: ['eye:62,54,.85,0', 'fist:118,48,.75,0'],
  c_late: ['hourglass:56,52,.85,0', 'fist:116,48,.8,0'],
  c_lead: ['fist', 'wing:30,26,.5,0'],
  c_breakcharge: ['hourglass:56,52,.8,0', 'fist:116,48,.8,0'],
  sm_dart: ['rush', 'wing:128,24,.45,0'],
  wg_dive: ['dive', 'wing:128,26,.5,0'],
  fi_charge: ['recoil'],
  as_sucker: ['ninja', 'burst:128,28,.5,0'],
  c_quickdraw: ['spear', 'cards:128,28,.5,0'],
  sw_rapid: ['slash', 'slash:128,68,.5,20'],
  sw_cut: ['slash'],
  sw_x: ['xslash'],
  sw_great: ['slash:80,52,1.15,0', 'burst:34,30,.55,0'],
  ey_aim: ['target'],
  ey_snipe: ['target', 'pierce:80,50,.9,0'],
  fi_finish: ['fang'],
  wd_bolt: ['orb'],
  wd_mega: ['orb:84,50,1.1,0', 'burst:36,28,.5,0'],
  fi_rampage: ['recoil'],
  wi_slam: ['fist', 'roar:30,26,.45,0'],
  sp_horn: ['horn'],
  as_trick: ['dizzy', 'zzz:132,26,.5,0'],
  u_poison_needle: ['needle', 'venom:126,50,.6,0'],
  co_rainbow: ['rainbow', 'orb:128,28,.5,0'],
  c_vampire: ['bite', 'heart:128,26,.5,0'],
  c_scorch: ['look:62,54,.85,0', 'fist:118,48,.75,0'],
  c_bully: ['glare:62,54,.85,0', 'up:120,46,.7,0'],
  ch_megapunch: ['fist'],
  ch_rollout: ['roll'],
  ch_skyfall: ['dive', 'wing:30,26,.5,0'],
  ch_bigslash: ['slash:80,52,1.15,0'],
  ch_pray: ['heart', 'cure:128,26,.5,0'],
  // ほのお
  f_spark: ['ember'],
  fire_a2: ['flame'],
  f_whirl: ['fire_ring'],
  f_spread: ['flame', 'ember:34,70,.55,0'],
  f_blaze: ['flame', 'flame:128,66,.5,10'],
  f_burnout: ['flame:62,52,.9,0', 'fang:118,48,.75,0'],
  ch_inferno: ['flame'],
  fire_sig: ['burst:80,50,1.2,0', 'flame:80,54,.95,0'],
  f_stoke: ['flame:58,54,.85,0', 'muscle:116,44,.8,0'],
  fire_dry: ['flame:58,54,.85,0', 'cure:116,46,.75,0'],
  // みず
  w_gun: ['drops', 'rush:128,70,.45,0'],
  water_a2: ['wave'],
  w_wave: ['wave', 'down:130,26,.5,0'],
  w_icicle: ['snow', 'down:130,26,.5,0'],
  w_steam: ['wave:58,56,.85,0', 'flame:118,42,.8,0'],
  ch_whirlpool: ['swirl'],
  water_sig: ['burst:80,50,1.2,0', 'wave:80,54,.9,0'],
  water_wash: ['bubble', 'cure:128,26,.5,0'],
  w_spring: ['cure', 'bubble:36,64,.6,0'],
  w_wall: ['shield:60,52,.85,0', 'wave:118,62,.65,0'],
  w_bubble: ['bubble', 'down:130,26,.5,0'],
  // き
  k_sprout: ['sprout'],
  wood_a2: ['vine'],
  k_seed: ['seed'],
  k_vine: ['vine', 'venom:130,26,.5,0'],
  k_burn: ['leaf:58,52,.9,0', 'flame:118,44,.8,0'],
  ch_wrath: ['root'],
  wood_sig: ['burst:80,50,1.2,0', 'vine:80,54,.95,0'],
  wood_root: ['root:60,52,.85,0', 'shield:118,48,.7,0'],
  k_komorebi: ['sunrays:50,34,.8,0', 'sprout:104,56,.9,0'],
  k_thorns: ['shield:60,52,.85,0', 'vine:118,56,.7,0'],
  k_powder: ['venom', 'cloud:34,68,.55,0'],
  // かみなり
  b_zap: ['spark'],
  bolt_a2: ['bolt'],
  b_flash: ['bolt:54,52,.8,0', 'bolt:110,48,.8,0'],
  b_spear: ['spear', 'drops:128,28,.5,0'],
  b_shock: ['bolt:60,52,.9,0', 'fist:122,46,.7,0'],
  b_spark2: ['spark:62,52,.9,0', 'hourglass:120,46,.7,0'],
  b_rising: ['bolt', 'crit:130,26,.5,0'],
  ch_thunder: ['cloud:80,40,1,0', 'bolt:80,62,.7,0'],
  bolt_sig: ['burst:80,50,1.2,0', 'bolt:80,52,.95,0'],
  b_static: ['bolt:58,52,.85,0', 'up:118,48,.75,0'],
  b_flashidea: ['bolt:58,52,.85,0', 'cards:118,50,.75,0'],
  // やみ
  d_shadow: ['moon'],
  dark_a2: ['slash', 'moon:128,26,.5,0'],
  d_sneak: ['ninja', 'down:130,26,.5,0'],
  d_eatdream: ['moon:58,52,.9,0', 'bite:118,50,.6,0'],
  d_curse: ['claw', 'moon:128,26,.5,0'],
  ch_blackhole: ['swirl'],
  dark_sig: ['bite', 'moon:128,26,.5,0'],
  d_lullaby: ['moon:58,52,.85,0', 'zzz:116,44,.85,0'],
  d_scramble: ['cards:58,52,.85,0', 'down:118,48,.7,0'],
  d_moonpray: ['moon:58,52,.85,0', 'heart:118,48,.7,0'],
  d_hex: ['eye:60,52,.85,0', 'down:118,48,.7,0'],
  // まもり・かいふく・つよく・よわらせ
  c_guard: ['shield'],
  sh_counter: ['counter', 'shield:128,26,.5,0'],
  c_roll: ['roll', 'heart:128,26,.5,0'],
  c_dodge: ['shield:60,52,.85,0', 'cards:118,50,.7,0'],
  ca_heal: ['heart'],
  ca_breath: ['cure'],
  u_detox: ['bubble', 'cure:128,26,.5,0'],
  c_onigiri: ['rice', 'cards:130,28,.45,0'],
  c_rest: ['heart', 'cure:128,26,.5,0'],
  c_lunch: ['rice', 'shield:128,26,.5,0'],
  c_focus: ['muscle'],
  wg_flap: ['wing', 'up:130,26,.5,0'],
  ey_read: ['clover'],
  c_wish: ['wishstar'],
  c_gather: ['cards', 'fist:130,28,.45,0'],
  c_ward: ['cards:58,52,.85,0', 'heart:118,48,.7,0'],
  ey_glare: ['glare'],
  ta_look: ['look', 'down:130,26,.5,0'],
  bg_roar: ['roar'],
  c_disturb: ['cards', 'down:130,28,.45,0'],
  // とくしゅ
  f_rain: ['rain'],
  f_sun: ['sun'],
  f_thunder: ['thundercloud'],
  f_night: ['night'],
  br_sub: ['dome'],
  br_magic: ['dome'],
  br_ice: ['dome'],
  tm_bomb: ['bomb'],
  tm_trap: ['spikes'],
  tm_gift: ['gift'],
  sc_life: ['heartcrack'],
  sc_bond: ['chain'],
  sc_endure: ['shield'],
  cp_copy: ['mirror'],
  cp_nobig: ['ban'],
  cp_noguard: ['ban'],
  sw_heart: ['swapheart'],
  sw_dump: ['swap'],
  sw_steal: ['swap'],
  gm_dice: ['dice'],
  gm_coin: ['coin'],
  gm_all: ['wishstar'],
  fc_taunt: ['megaphone'],
  fc_read: ['readeye'],
};

const RIBBON: Record<Cond['t'], string> = {
  foeHas: 'つけこみ',
  selfHas: 'いかし',
  foeHp: 'とどめ',
  selfHp: 'ピンチ',
  first: 'せんて',
  second: 'あとだし',
  foePick: 'よみ',
  prev: 'コンボ',
  foeCharging: 'ためつぶし',
};

export function artFor(m: MoveDef): ArtSpec {
  const pal = PALETTES[m.attribute ?? (m.category === 'attack' ? 'atk' : 'sup')];
  const motifs = CARD_MOTIFS[m.id] ?? [m.category === 'attack' ? 'burst' : 'cure'];
  return {
    pal,
    motifs,
    quick: !!(m.first || m.guardPct || m.reflect || (m.buff && m.buff.stat === 'def')),
    charge: !!m.charge,
    ribbon: m.when ? RIBBON[m.when.t] : null,
    hand: !!m.hand,
    attack: m.category === 'attack',
  };
}

export function koseiArt(): ArtSpec {
  return { pal: PALETTES.kosei, motifs: ['kosei'], quick: true, charge: false, ribbon: null, hand: false, attack: true };
}

export const ART_IDS = Object.keys(CARD_MOTIFS);
