import type { Illust } from './illust';
import { Burst, INK, Sfx } from './illust';
import {
  Arrow, At, Aura, Ball, Barrier, BigArrow, Blaze, Bolt, Bomb, Bond, Bento, Bubble, Bulb, Caltrop, Chain, Charm, Claws, Coin, Crescent,
  Drip, Eye, Fang, Fire, Fireball, FireSwirl, Fist, Gift, Halo, Heart, Horn, Hourglass, Icicle, Impact, Jet, Leaf, Lock, MiniCard, Mirror,
  Needle, Note, Onigiri, P, PAPER, Plus, PoisonCloud, PrayHands, Puff, Rain, Rings, Roar, Seed, ShadowMask, Shield, SlashArc, SparkBall,
  Sparkles, Spiral, Splash, Sprout, Stage, Star, StormCloud, Streaks, Sun, Swap, Sword, Target, Tea, Vine, Vortex, Wave, Wing, Wisp,
  Halo as Glow2, Caltrop as Spike, Water, Wood, Elec, Dark, Atk, Sup, ink,
} from './objects';

void Glow2;
void Spike;

/**
 * のこりの カードの 描きおろし（キャラなし・技の「もの」）。部品は objects.tsx。
 * 見本 8まい（illust.tsx の ILLUST）と おなじ 描きかた：大きく・ななめ・ひかり・集中線。
 */
export const ILLUST2: Record<string, Illust> = {
  // ============================== ふつうの こうげき
  c_scratch: (p) => (
    <g>
      <Stage p={p} cx={100} cy={80} />
      <At x={100} y={80} r={20} s={1.15}>
        <Claws p={p} />
      </At>
      <Sparkles pts={[[40, 30], [168, 128], [170, 36, 5]]} />
    </g>
  ),
  c_headbutt: (p) => (
    <g>
      <Stage p={p} cx={126} cy={70} />
      <At x={130} y={66}>
        <Impact p={p} r={34} />
      </At>
      <At x={70} y={98} r={-30}>
        <Streaks n={5} len={70} gap={10} />
      </At>
      <At x={90} y={90}>
        <Ball p={p} r={44} />
      </At>
      {[0, 1, 2].map((i) => (
        <At key={i} x={130 + Math.cos(i * 2.1) * 34} y={36 + Math.sin(i * 2.1) * 10}>
          <Star r={8} />
        </At>
      ))}
    </g>
  ),
  c_twin: (p) => (
    <g>
      <Stage p={p} />
      <At x={84} y={80} r={24}>
        <Claws p={p} n={2} />
      </At>
      <At x={120} y={80} r={-24}>
        <Claws p={p} n={2} />
      </At>
      <Sparkles pts={[[100, 24], [100, 140, 5]]} />
    </g>
  ),
  c_rush: (p) => (
    <g>
      <Stage p={p} cx={140} cy={78} />
      {[
        [70, 46, -10, 0.55],
        [52, 84, 6, 0.6],
        [86, 116, 18, 0.55],
        [118, 60, -4, 0.7],
        [104, 92, 8, 0.8],
      ].map(([x, y, r, s], i) => (
        <At key={i} x={x} y={y} r={r} s={s}>
          <Streaks n={3} len={50} gap={10} />
          <Fist p={p} />
        </At>
      ))}
      <At x={160} y={78}>
        <Impact p={p} r={24} />
      </At>
    </g>
  ),
  c_onetwo: (p) => (
    <g>
      <Stage p={p} cx={146} cy={70} />
      <At x={82} y={110} r={-8} s={0.75} o={0.75}>
        <Fist p={p} />
      </At>
      <At x={104} y={68} r={-14} s={1.1}>
        <Streaks n={4} len={60} gap={12} />
        <Fist p={p} />
      </At>
      <At x={160} y={56}>
        <Impact p={p} r={20} />
      </At>
      <Sfx x={60} y={40} text="1・2！" size={20} fill={p.light} rot={-10} />
    </g>
  ),
  c_counterpunch: (p) => (
    <g>
      <Stage p={p} cx={130} cy={76} />
      <At x={64} y={84} r={-10} s={0.75}>
        <Shield face={P.water} />
      </At>
      <At x={120} y={70} r={-10} s={1}>
        <Streaks n={4} len={50} gap={12} />
        <Fist p={p} />
      </At>
      <At x={168} y={58}>
        <Impact p={p} r={20} />
      </At>
    </g>
  ),
  c_desperate: (p) => (
    <g>
      <Stage p={p} cx={104} cy={76} />
      <At x={100} y={78}>
        <Aura p={p} r={70} />
      </At>
      <At x={70} y={110} s={0.7}>
        <Heart fill="#ff6f8c" />
      </At>
      <path d="M70,96 L66,104 L72,108 L68,118" fill="none" {...ink(2.6)} />
      <At x={116} y={70} r={-20} s={1.05}>
        <Fist p={p} />
      </At>
    </g>
  ),
  c_foresight: (p) => (
    <g>
      <Stage p={p} cx={100} cy={74} />
      <At x={100} y={92} s={0.9}>
        <Target p={p} />
      </At>
      <At x={100} y={40} s={0.6}>
        <Eye p={P.dark} />
      </At>
    </g>
  ),
  c_late: (p) => (
    <g>
      <Stage p={p} cx={130} cy={78} />
      <At x={56} y={84} s={0.85}>
        <Hourglass />
      </At>
      <At x={138} y={78} r={-10} s={0.95}>
        <Streaks n={4} len={40} gap={12} />
        <Fist p={p} />
      </At>
    </g>
  ),
  c_lead: (p) => (
    <g>
      <Stage p={p} cx={150} cy={66} />
      <At x={110} y={84} r={-18} s={1}>
        <Streaks n={6} len={110} gap={9} />
        <Fist p={p} />
      </At>
      <At x={162} y={56}>
        <Impact p={p} r={20} />
      </At>
      <At x={44} y={34}>
        <Star r={16} />
      </At>
    </g>
  ),
  c_breakcharge: (p) => (
    <g>
      <Stage p={p} cx={128} cy={76} />
      <At x={136} y={76}>
        <Aura p={P.kosei} r={50} />
      </At>
      <At x={136} y={76}>
        <Impact p={p} r={30} />
      </At>
      <At x={86} y={88} r={-14} s={1}>
        <Fist p={p} />
      </At>
    </g>
  ),
  sm_dart: (p) => (
    <g>
      <Stage p={p} cx={150} cy={70} />
      {[0.15, 0.3, 0.5].map((o, i) => (
        <At key={i} x={60 + i * 26} y={98 - i * 10} o={o}>
          <Ball p={p} r={22} />
        </At>
      ))}
      <At x={146} y={68}>
        <Streaks n={5} len={80} gap={9} />
        <Ball p={p} r={24} />
      </At>
    </g>
  ),
  wg_dive: (p) => (
    <g>
      <Stage p={P.water} cx={120} cy={112} />
      <At x={60} y={40} r={-35}>
        <Streaks n={5} len={70} gap={10} />
      </At>
      <At x={110} y={80} r={40} s={1.1}>
        <Wing p={p.light ? P.water : p} />
      </At>
      <At x={140} y={130}>
        <Impact p={P.water} r={18} />
      </At>
    </g>
  ),
  fi_charge: (p) => (
    <g>
      <Stage p={p} cx={156} cy={64} />
      <At x={100} y={92} r={-16} s={1.1}>
        <Streaks n={5} len={110} gap={11} />
        <Horn p={p} />
      </At>
      <At x={160} y={50}>
        <Impact p={p} r={20} />
      </At>
    </g>
  ),
  as_sucker: (p) => (
    <g>
      <Stage p={P.dark} cx={130} cy={70} dark />
      <At x={84} y={86} s={1}>
        <ShadowMask p={P.dark} />
      </At>
      <At x={146} y={60} r={-40} s={0.55}>
        <Sword />
      </At>
      <At x={160} y={44}>
        <Impact p={p} r={14} />
      </At>
    </g>
  ),
  c_quickdraw: (p) => (
    <g>
      <Stage p={p} cx={160} cy={66} />
      <At x={104} y={82} r={-14} s={1.3}>
        <Streaks n={5} len={60} gap={9} />
        <Arrow len={110} />
      </At>
      <At x={172} y={64}>
        <Impact p={p} r={16} />
      </At>
    </g>
  ),
  sw_rapid: (p) => (
    <g>
      <Stage p={p} />
      {[-30, 0, 30].map((dy, i) => (
        <At key={i} x={100 + i * 6} y={80 + dy} r={-24 + i * 10} s={0.62}>
          <SlashArc p={p} />
        </At>
      ))}
      <Sfx x={160} y={36} text="×3" size={22} fill={p.light} rot={-8} />
    </g>
  ),
  sw_cut: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={80} r={-30} s={0.9}>
        <SlashArc p={p} />
      </At>
      <At x={70} y={110} r={40} s={0.85}>
        <Sword />
      </At>
    </g>
  ),
  sw_x: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={80} r={-35} s={0.85}>
        <SlashArc p={p} />
      </At>
      <At x={100} y={80} r={125} s={0.85}>
        <SlashArc p={p} />
      </At>
      <At x={100} y={80}>
        <Impact p={p} r={14} />
      </At>
    </g>
  ),
  sw_great: (p) => (
    <g>
      <Stage p={p} cx={110} cy={70} />
      <At x={100} y={80} r={-38} s={1.2}>
        <SlashArc p={p} w={22} />
      </At>
      <At x={82} y={96} r={45} s={1.25}>
        <Sword />
      </At>
      <At x={150} y={40}>
        <Impact p={p} r={18} />
      </At>
    </g>
  ),
  ey_aim: (p) => (
    <g>
      <Stage p={p} cx={110} cy={74} />
      <At x={116} y={76}>
        <Target p={p} />
      </At>
      <At x={84} y={92} r={-24} s={0.9}>
        <Arrow len={100} />
      </At>
      <Sparkles pts={[[160, 30], [40, 40, 5]]} />
    </g>
  ),
  ey_snipe: (p) => (
    <g>
      <Stage p={p} cx={120} cy={72} />
      <At x={130} y={74} s={0.75} o={0.9}>
        <Shield face={P.water} />
      </At>
      <At x={100} y={78} r={-6} s={1.4}>
        <Arrow len={130} color="url(#gv-gold)" />
      </At>
      <At x={46} y={40} s={0.45}>
        <Target p={p} />
      </At>
    </g>
  ),
  fi_finish: (p) => (
    <g>
      <Stage p={p} cx={100} cy={86} dark />
      <At x={74} y={20} r={-8} s={1.3}>
        <Fang />
      </At>
      <At x={126} y={20} r={8} s={1.3}>
        <Fang />
      </At>
      <At x={100} y={110}>
        <Impact p={p} r={28} />
      </At>
    </g>
  ),
  wd_bolt: () => (
    <g>
      <Stage p={P.kosei} cx={140} cy={70} />
      <At x={110} y={84} r={-18}>
        <Streaks n={5} len={80} gap={9} />
        <Ball p={P.kosei} r={26} />
      </At>
      <At x={110} y={84}>
        <Star r={12} fill="#fff6c2" />
      </At>
      <Sparkles pts={[[160, 40], [50, 120], [170, 120, 5]]} />
    </g>
  ),
  wd_mega: (p) => (
    <g>
      <Stage p={P.kosei} cx={100} cy={78} />
      <At x={100} y={80}>
        <Aura p={P.kosei} r={68} />
      </At>
      <At x={100} y={80}>
        <Rings r={56} />
      </At>
      <At x={100} y={80}>
        <Ball p={P.kosei} r={34} />
      </At>
      <At x={100} y={80}>
        <Star r={16} fill="#fff6c2" />
      </At>
      <Sparkles pts={[[36, 30], [170, 136], [174, 30, 5]]} fill={p.light} />
    </g>
  ),
  fi_rampage: (p) => (
    <g>
      <Stage p={p} />
      <At x={60} y={50}>
        <Impact p={p} r={20} />
      </At>
      <At x={150} y={110}>
        <Impact p={p} r={22} />
      </At>
      <At x={84} y={100} r={30} s={0.8}>
        <Fist p={p} />
      </At>
      <At x={128} y={60} r={-150} s={0.8}>
        <Fist p={p} />
      </At>
      <Sfx x={100} y={30} text="ドカドカ" size={18} fill={p.light} rot={6} />
    </g>
  ),
  wi_slam: (p) => (
    <g>
      <Stage p={p} cx={100} cy={120} />
      <path d="M0,132 L200,132 L200,160 L0,160Z" fill={p.bg2} {...ink(2.4)} />
      <path d="M100,132 L84,148 L92,160 M100,132 L118,150 M100,132 L64,140 M100,132 L140,140" fill="none" {...ink(2.4)} />
      <At x={100} y={30} r={90}>
        <Streaks n={5} len={30} gap={14} />
      </At>
      <At x={100} y={86} s={1.25} sx={1.45}>
        <Ball p={p} r={34} />
      </At>
    </g>
  ),
  sp_horn: (p) => (
    <g>
      <Stage p={p} cx={146} cy={50} />
      <At x={92} y={96} s={1.5}>
        <Horn p={p} />
      </At>
      <At x={156} y={36}>
        <Impact p={p} r={18} />
      </At>
    </g>
  ),
  as_trick: () => (
    <g>
      <Stage p={P.kosei} />
      <At x={100} y={80}>
        <Spiral color="#c7a4ff" w={7} turns={3} r={58} />
      </At>
      <Sfx x={150} y={40} text="Zzz" size={22} fill="#c8baff" rot={-10} />
      <Sparkles pts={[[40, 30], [170, 130]]} />
    </g>
  ),
  u_poison_needle: () => (
    <g>
      <Stage p={P.dark} cx={140} cy={80} />
      <At x={56} y={44}>
        <PoisonCloud s={0.9} />
      </At>
      <At x={104} y={92} r={-24} s={1.7}>
        <Needle drop="#a77ae0" />
      </At>
    </g>
  ),
  co_rainbow: () => (
    <g>
      <Stage p={P.kosei} />
      <g opacity={0.6}>
        {['#ff8a8a', '#ffd36e', '#9be59b', '#8ac6ff', '#c7a4ff'].map((c, i) => (
          <circle key={c} cx={100} cy={80} r={58 - i * 8} fill="none" stroke={c} strokeWidth={8} />
        ))}
      </g>
      <At x={100} y={80}>
        <Ball p={P.kosei} r={26} />
      </At>
      <path d="M78,74 A24,24 0 0 1 122,74" fill="none" stroke="#ffd36e" strokeWidth={5} />
      <path d="M80,84 A22,22 0 0 0 120,84" fill="none" stroke="#9be59b" strokeWidth={5} />
      <Sparkles pts={[[30, 30], [170, 30], [170, 130], [30, 130]]} />
    </g>
  ),
  c_vampire: (p) => (
    <g>
      <Stage p={p} cx={100} cy={100} dark />
      <At x={82} y={8} r={-6} s={1.2}>
        <Fang />
      </At>
      <At x={118} y={8} r={6} s={1.2}>
        <Fang />
      </At>
      <At x={100} y={116} s={0.8}>
        <Heart />
      </At>
      <Drip x={100} y={92} r={5} p={P.atk} />
      <Plus x={150} y={110} color="#2fa862" />
    </g>
  ),
  c_scorch: () => (
    <g>
      <Stage p={P.dark} />
      <At x={110} y={96}>
        <PoisonCloud s={1} />
      </At>
      <At x={100} y={70} r={20}>
        <Claws p={P.dark} color="#a77ae0" />
      </At>
    </g>
  ),
  c_bully: (p) => (
    <g>
      <Stage p={p} cx={120} cy={70} />
      <At x={120} y={84} s={0.9}>
        <BigArrow color="#2fa862" />
      </At>
      <At x={120} y={60}>
        <Impact p={p} r={24} />
      </At>
      <At x={66} y={70} r={-10} s={0.8}>
        <Fist p={p} />
      </At>
    </g>
  ),
  ch_rollout: (p) => (
    <g>
      <Stage p={p} cx={100} cy={90} />
      <path d="M0,130 L200,130 L200,160 L0,160Z" fill={p.bg2} {...ink(2.4)} />
      <At x={60} y={94}>
        <Streaks n={5} len={60} gap={10} />
      </At>
      <At x={110} y={90}>
        <Spiral color={p.light} w={5} turns={2} r={50} />
      </At>
      <At x={110} y={90}>
        <Ball p={p} r={38} />
      </At>
      {[
        [40, 128, 10],
        [24, 122, 7],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={PAPER} {...ink(2)} />
      ))}
    </g>
  ),
  ch_skyfall: () => (
    <g>
      <Stage p={P.water} cx={110} cy={130} />
      <At x={50} y={30} s={0.6}>
        <Puff />
      </At>
      <At x={70} y={40} r={-40}>
        <Streaks n={6} len={90} gap={10} />
      </At>
      <At x={112} y={86} r={50} s={1.15}>
        <Wing p={P.water} />
      </At>
      <At x={138} y={134}>
        <Impact p={P.water} r={22} />
      </At>
    </g>
  ),
  ch_bigslash: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={80}>
        <Aura p={p} r={70} />
      </At>
      <At x={100} y={80} r={-40} s={1.3}>
        <SlashArc p={p} w={24} />
      </At>
      <At x={100} y={80} r={-40} s={0.8} o={0.7}>
        <SlashArc p={p} w={14} />
      </At>
    </g>
  ),
  ch_pray: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={84}>
        <Aura p={P.kosei} r={66} />
      </At>
      <At x={100} y={84} s={1}>
        <PrayHands />
      </At>
      <Plus x={44} y={50} color="#2fa862" />
      <Plus x={156} y={46} color="#2fa862" delay={0.4} />
      <Sparkles pts={[[100, 18], [40, 130, 5], [164, 128, 5]]} />
    </g>
  ),

  // ============================== ほのお
  fire_a2: (p) => (
    <g>
      <Stage p={p} cx={100} cy={96} />
      <At x={60} y={110} s={0.8}>
        <Blaze p={p} delay={0.2} />
      </At>
      <At x={140} y={110} s={0.85}>
        <Blaze p={p} delay={0.35} />
      </At>
      <At x={100} y={92} s={1.3}>
        <Blaze p={p} />
      </At>
    </g>
  ),
  f_whirl: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={80} s={1.3}>
        <FireSwirl p={p} />
      </At>
      <Sparkles pts={[[30, 30, 4], [170, 130, 4], [170, 30, 4]]} fill="#fff2a8" />
    </g>
  ),
  f_spread: (p) => (
    <g>
      <Stage p={p} cx={100} cy={110} />
      <path d="M0,128 L200,128 L200,160 L0,160Z" fill="#6e3b2a" {...ink(2.4)} />
      {[
        [30, 124, 0.45],
        [66, 118, 0.6],
        [104, 112, 0.85],
        [140, 118, 0.6],
        [174, 124, 0.45],
      ].map(([x, y, s], i) => (
        <At key={i} x={x} y={y} s={s}>
          <Blaze p={p} delay={i * 0.12} />
        </At>
      ))}
      <path d="M20,140 L180,140" stroke="#ffb347" strokeWidth={3} strokeDasharray="10 8" filter="url(#glow)" />
    </g>
  ),
  f_blaze: (p) => (
    <g>
      <Stage p={p} cx={100} cy={80} />
      <At x={100} y={84}>
        <Aura p={p} r={70} />
      </At>
      <At x={100} y={96} s={1.7}>
        <Blaze p={p} />
      </At>
    </g>
  ),
  f_burnout: (p) => (
    <g>
      <Stage p={p} cx={100} cy={96} dark />
      <path d="M0,124 L200,124 L200,160 L0,160Z" fill="#3a1d14" {...ink(2.4)} />
      <path d="M30,136 l14,-6 l10,8 l16,-4 M120,142 l12,-8 l14,6 l10,-5" fill="none" stroke="#ffb347" strokeWidth={3} filter="url(#glow)" />
      {[
        [40, 112, 0.7],
        [100, 104, 1.3],
        [160, 112, 0.8],
      ].map(([x, y, s], i) => (
        <At key={i} x={x} y={y} s={s}>
          <Blaze p={p} delay={i * 0.2} />
        </At>
      ))}
      <Sparkles pts={[[60, 30, 4], [140, 24, 4], [100, 40, 3]]} fill="#ffe27a" />
    </g>
  ),
  ch_inferno: (p) => (
    <g>
      <Stage p={p} cx={110} cy={74} />
      <At x={110} y={74}>
        <Aura p={p} r={72} />
      </At>
      <At x={116} y={74} r={-28} s={2.1}>
        <Fireball p={p} />
      </At>
    </g>
  ),
  fire_sig: (p) => (
    <g>
      <Stage p={p} cx={160} cy={60} />
      <At x={90} y={92} r={-24}>
        <Jet p={p} len={210} w={44} />
      </At>
      <At x={168} y={54}>
        <Impact p={p} r={28} />
      </At>
      <Sparkles pts={[[40, 30], [180, 130]]} fill="#fff2a8" />
    </g>
  ),
  f_stoke: (p) => (
    <g>
      <Stage p={p} cx={90} cy={90} />
      <At x={84} y={104} s={1.1}>
        <Blaze p={p} />
      </At>
      <At x={150} y={74} s={0.7}>
        <BigArrow color={p.main} />
      </At>
      <Sparkles pts={[[40, 40, 4], [120, 30, 4]]} fill="#fff2a8" />
    </g>
  ),
  fire_dry: (p) => (
    <g>
      <Stage p={p} cx={100} cy={90} />
      <At x={100} y={92}>
        <Aura p={p} r={70} />
      </At>
      {[44, 76, 108].map((y, i) => (
        <g key={y} className="ill-float" style={{ animationDelay: `${i * 0.25}s` }}>
          <path d={`M24,${y} q19,-14 38,0 t38,0 t38,0 t38,0`} fill="none" stroke={INK} strokeWidth={10} strokeLinecap="round" />
          <path d={`M24,${y} q19,-14 38,0 t38,0 t38,0 t38,0`} fill="none" stroke={i === 1 ? p.light : p.main} strokeWidth={6} strokeLinecap="round" />
        </g>
      ))}
      <Plus x={166} y={130} s={1.3} color="#2fa862" />
      <At x={40} y={132} s={0.45}>
        <Icicle h={40} />
      </At>
    </g>
  ),

  // ============================== みず
  w_gun: (p) => (
    <g>
      <Stage p={p} cx={160} cy={60} />
      <At x={100} y={86} r={-20} s={0.8}>
        <Jet p={p} len={170} w={28} />
      </At>
      <At x={170} y={52} r={-20} s={0.7}>
        <Splash p={p} />
      </At>
      <Drip x={150} y={110} p={p} />
      <Drip x={180} y={92} r={4} p={p} delay={0.3} />
    </g>
  ),
  water_a2: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={80}>
        <Aura p={p} r={70} />
      </At>
      <At x={100} y={80} s={1.25}>
        <Spiral color={p.main} w={12} turns={3} r={58} />
      </At>
      <At x={100} y={60} s={0.7}>
        <Icicle />
      </At>
      <Sparkles pts={[[40, 30], [170, 130], [170, 28, 5]]} />
    </g>
  ),
  w_wave: (p) => (
    <g>
      <Stage p={p} cx={100} cy={70} />
      <At x={100} y={96} s={1.15}>
        <Wave p={p} />
      </At>
      <Drip x={170} y={40} p={p} />
      <Drip x={150} y={24} r={4} p={p} delay={0.3} />
    </g>
  ),
  w_icicle: (p) => (
    <g>
      <Stage p={p} cx={100} cy={110} />
      {[
        [56, 10, 0.9],
        [100, 0, 1.2],
        [146, 14, 0.8],
      ].map(([x, y, s], i) => (
        <At key={i} x={x} y={y} s={s}>
          <Icicle h={80} w={26} />
        </At>
      ))}
      <At x={100} y={126}>
        <Impact p={p} r={20} />
      </At>
    </g>
  ),
  w_steam: (p) => (
    <g>
      <Stage p={Fire} cx={100} cy={96} />
      <At x={100} y={110}>
        <Impact p={Fire} r={30} />
      </At>
      <At x={80} y={60} s={1.1}>
        <Puff />
      </At>
      <At x={136} y={46} s={0.8}>
        <Puff />
      </At>
      <Drip x={40} y={100} p={p} />
    </g>
  ),
  ch_whirlpool: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={84}>
        <Aura p={p} r={70} />
      </At>
      <At x={100} y={84} s={1.3}>
        <Spiral color={p.light} w={9} turns={4} r={60} />
      </At>
      <Bubble x={40} y={40} r={8} />
      <Bubble x={166} y={130} r={6} delay={0.3} />
    </g>
  ),
  water_wash: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={110} s={1.3}>
        <Splash p={p} />
      </At>
      {[
        [60, 60, 14],
        [130, 46, 10],
        [150, 92, 12],
        [80, 30, 7],
      ].map(([x, y, r], i) => (
        <Bubble key={i} x={x} y={y} r={r} delay={i * 0.2} />
      ))}
      <Sparkles pts={[[40, 120], [170, 30]]} />
    </g>
  ),
  w_spring: (p) => (
    <g>
      <Stage p={p} cx={100} cy={70} />
      <path d="M0,128 L200,128 L200,160 L0,160Z" fill="#8e8a80" {...ink(2.4)} />
      <At x={100} y={92} s={1.6}>
        <Splash p={p} />
      </At>
      <path d="M100,120 L100,60" stroke={p.light} strokeWidth={14} strokeLinecap="round" opacity={0.7} />
      <Drip x={64} y={60} p={p} />
      <Drip x={140} y={50} p={p} delay={0.3} />
      <Plus x={164} y={110} color="#2fa862" />
    </g>
  ),
  w_wall: (p) => (
    <g>
      <Stage p={p} />
      {[0, 1, 2].map((i) => (
        <At key={i} x={100} y={130 - i * 30} s={1 - i * 0.12} sx={1.1 - i * 0.12}>
          <Wave p={p} />
        </At>
      ))}
      <At x={156} y={40} s={0.4}>
        <Shield face={p} />
      </At>
    </g>
  ),
  w_bubble: (p) => (
    <g>
      <Stage p={p} />
      <Bubble x={100} y={80} r={52} />
      <Bubble x={44} y={40} r={12} delay={0.2} />
      <Bubble x={160} y={124} r={10} delay={0.4} />
      <At x={100} y={80} s={0.35} o={0.8}>
        <Shield face={p} />
      </At>
    </g>
  ),

  // ============================== き
  k_sprout: (p) => (
    <g>
      <Stage p={p} cx={100} cy={80} />
      <path d="M0,124 Q100,112 200,124 L200,160 L0,160Z" fill="#8a5a3a" {...ink(2.4)} />
      <At x={100} y={90} s={1.4}>
        <Sprout p={p} />
      </At>
      <Sparkles pts={[[40, 30], [160, 40]]} />
    </g>
  ),
  wood_a2: (p) => (
    <g>
      <Stage p={p} />
      <Vine p={p} d="M10,150 C40,60 120,140 140,60 C150,24 180,20 190,30" thorns />
      <At x={190} y={30}>
        <Impact p={p} r={14} />
      </At>
      <At x={60} y={96} r={-30} s={0.6}>
        <Leaf p={p} />
      </At>
    </g>
  ),
  k_seed: (p) => (
    <g>
      <Stage p={p} cx={160} cy={70} />
      {[
        [60, 50],
        [90, 90],
        [120, 60],
        [70, 120],
        [140, 104],
        [40, 84],
      ].map(([x, y], i) => (
        <At key={i} x={x} y={y} r={-70}>
          <At r={70}>
            <Streaks n={2} len={30} gap={6} />
          </At>
          <Seed s={1.25} />
        </At>
      ))}
      <At x={168} y={70}>
        <Impact p={p} r={18} />
      </At>
    </g>
  ),
  k_vine: (p) => (
    <g>
      <Stage p={p} />
      <Vine p={p} d="M30,140 C10,100 60,70 100,80 C150,90 170,40 130,26 C96,14 80,50 100,60" />
      <At x={130} y={110}>
        <PoisonCloud s={0.6} />
      </At>
      <At x={44} y={60} r={20} s={0.6}>
        <Leaf p={p} />
      </At>
    </g>
  ),
  k_burn: (p) => (
    <g>
      <Stage p={Fire} />
      <At x={84} y={86} r={-20} s={2.2}>
        <Leaf p={p} />
      </At>
      <At x={128} y={84} s={1.1}>
        <Blaze p={Fire} />
      </At>
    </g>
  ),
  ch_wrath: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={80}>
        <Aura p={p} r={72} />
      </At>
      {Array.from({ length: 8 }, (_, i) => (
        <At key={i} x={100 + Math.cos(i * 0.8) * 50} y={80 + Math.sin(i * 0.8) * 40} r={i * 45} s={0.7}>
          <Leaf p={p} />
        </At>
      ))}
      <At x={100} y={80}>
        <Impact p={p} r={26} />
      </At>
    </g>
  ),
  wood_sig: (p) => (
    <g>
      <Stage p={p} />
      <Vine p={p} d="M0,30 C60,60 140,20 200,80" thorns />
      <Vine p={p} d="M0,130 C60,90 140,140 200,40" />
      <Vine p={p} d="M60,0 C80,60 120,100 100,160" />
      <At x={100} y={82}>
        <Impact p={p} r={16} />
      </At>
      <At x={160} y={120} r={30} s={0.6}>
        <Leaf p={p} />
      </At>
    </g>
  ),
  wood_root: (p) => (
    <g>
      <Stage p={p} cx={100} cy={60} />
      <path d="M0,96 Q100,84 200,96 L200,160 L0,160Z" fill="#8a5a3a" {...ink(2.4)} />
      <Vine p={{ ...p, main: '#b07a4a', light: '#d9a878' }} d="M100,96 C90,120 60,130 30,150" />
      <Vine p={{ ...p, main: '#b07a4a', light: '#d9a878' }} d="M100,96 C110,124 140,130 170,152" />
      <Vine p={{ ...p, main: '#b07a4a', light: '#d9a878' }} d="M100,96 L100,156" />
      <At x={100} y={70} s={1.1}>
        <Sprout p={p} />
      </At>
    </g>
  ),
  k_komorebi: (p) => (
    <g>
      <Stage p={p} cx={100} cy={30} />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${80 + i * 10},0 L${40 + i * 30},160 L${56 + i * 30},160Z`} fill="#fff6c2" opacity={0.35} />
      ))}
      {[
        [30, 20, 20],
        [80, 10, -10],
        [140, 16, 30],
        [180, 26, -20],
      ].map(([x, y, r], i) => (
        <At key={i} x={x} y={y} r={r} s={1.2}>
          <Leaf p={p} />
        </At>
      ))}
      <Plus x={100} y={110} s={1.6} color="#2fa862" />
      <Sparkles pts={[[60, 90], [150, 100]]} />
    </g>
  ),
  k_thorns: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={78} s={0.85}>
        <Shield face={p} />
      </At>
      <Vine p={p} d="M40,30 C10,80 60,140 100,150 C150,150 190,80 160,30" thorns />
    </g>
  ),
  k_powder: () => (
    <g>
      <Stage p={P.dark} />
      <At x={100} y={86} s={1.4}>
        <PoisonCloud />
      </At>
      {[
        [40, 40],
        [160, 34],
        [60, 130],
        [150, 130],
        [100, 24],
      ].map(([x, y], i) => (
        <circle key={i} className="ill-float" style={{ animationDelay: `${i * 0.2}s` }} cx={x} cy={y} r={4} fill="#c7a4ff" stroke="#33302b" strokeWidth={1.4} />
      ))}
    </g>
  ),

  // ============================== かみなり
  b_zap: (p) => (
    <g>
      <Stage p={p} cx={150} cy={70} />
      <At x={110} y={84} r={-14}>
        <Streaks n={4} len={70} gap={10} />
      </At>
      <At x={120} y={80}>
        <SparkBall r={22} />
      </At>
    </g>
  ),
  bolt_a2: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={80} r={10} s={1.25}>
        <Bolt />
      </At>
      <At x={100} y={140}>
        <Impact p={p} r={16} />
      </At>
    </g>
  ),
  b_flash: (p) => (
    <g>
      <Stage p={p} cx={150} cy={70} />
      <At x={80} y={70} r={20} s={0.75}>
        <Bolt />
      </At>
      <At x={130} y={84} r={20} s={0.85}>
        <Bolt />
      </At>
      <At x={60} y={110} r={-20}>
        <Streaks n={4} len={60} gap={10} />
      </At>
    </g>
  ),
  b_spear: (p) => (
    <g>
      <Stage p={p} cx={160} cy={60} />
      <At x={100} y={86} r={-22} s={1.4}>
        <Arrow len={130} color="url(#gv-bolt)" fletch="#f2b705" />
      </At>
      <At x={70} y={60} r={20} s={0.5}>
        <Bolt />
      </At>
      <At x={168} y={56}>
        <Impact p={p} r={18} />
      </At>
    </g>
  ),
  b_shock: (p) => (
    <g>
      <Stage p={p} cx={100} cy={110} />
      <At x={96} y={62} r={10} s={1.1}>
        <Bolt />
      </At>
      <At x={100} y={122}>
        <Impact p={p} r={28} />
      </At>
    </g>
  ),
  b_spark2: (p) => (
    <g>
      <Stage p={p} cx={130} cy={80} />
      <At x={60} y={84} s={0.8}>
        <Hourglass sand="#f2b705" />
      </At>
      <At x={136} y={80}>
        <SparkBall r={26} />
      </At>
    </g>
  ),
  b_rising: (p) => (
    <g>
      <Stage p={p} cx={100} cy={40} />
      <At x={100} y={40} s={0.55}>
        <Target p={p} />
      </At>
      <At x={100} y={104} r={0} s={0.85}>
        <At r={-90}>
          <Streaks n={4} len={50} gap={10} />
        </At>
        <Bolt />
      </At>
    </g>
  ),
  ch_thunder: (p) => (
    <g>
      <Stage p={p} cx={100} cy={40} dark />
      <At x={100} y={34} s={1.4}>
        <StormCloud />
      </At>
      <At x={96} y={104} r={6} s={1}>
        <Bolt />
      </At>
      <At x={100} y={150}>
        <Impact p={p} r={14} />
      </At>
    </g>
  ),
  bolt_sig: (p) => (
    <g>
      <Stage p={p} cx={100} cy={40} dark />
      <At x={100} y={30} s={1.6}>
        <StormCloud />
      </At>
      {[
        [50, 100, 0.6],
        [100, 104, 0.9],
        [150, 100, 0.6],
      ].map(([x, y, s], i) => (
        <At key={i} x={x} y={y} r={8} s={s}>
          <Bolt />
        </At>
      ))}
    </g>
  ),
  b_static: (p) => (
    <g>
      <Stage p={p} />
      <At x={80} y={84}>
        <SparkBall r={28} />
      </At>
      <At x={152} y={78} s={0.6}>
        <BigArrow color={p.main} />
      </At>
    </g>
  ),
  b_flashidea: () => (
    <g>
      <Stage p={Elec} cx={100} cy={70} />
      <At x={100} y={74} s={1.2}>
        <Bulb />
      </At>
      <Sparkles pts={[[40, 30], [160, 30], [170, 120, 5]]} fill="#fff07a" />
    </g>
  ),

  // ============================== やみ
  d_shadow: (p) => (
    <g>
      <Stage p={p} dark />
      <At x={80} y={86} s={1.1}>
        <Wisp p={p} />
      </At>
      <At x={140} y={60} r={-40} s={0.8}>
        <Needle />
      </At>
      <At x={100} y={130} r={0} s={0.5}>
        <Spiral color={p.light} w={4} turns={2} r={40} />
      </At>
    </g>
  ),
  dark_a2: (p) => (
    <g>
      <Stage p={p} dark />
      <At x={150} y={40} s={0.6}>
        <Crescent p={p} />
      </At>
      <At x={96} y={86} r={-34} s={1}>
        <SlashArc p={p} color={p.light} />
      </At>
    </g>
  ),
  d_sneak: (p) => (
    <g>
      <Stage p={p} cx={150} cy={70} dark />
      {[0.2, 0.4].map((o, i) => (
        <At key={i} x={60 + i * 30} y={90} o={o}>
          <Wisp p={p} s={0.8} />
        </At>
      ))}
      <At x={140} y={86}>
        <Streaks n={4} len={60} gap={10} />
        <Wisp p={p} s={0.9} />
      </At>
    </g>
  ),
  d_eatdream: (p) => (
    <g>
      <Stage p={p} dark />
      <At x={130} y={60} s={0.8}>
        <Puff color="#ffe9f2" />
      </At>
      <Sfx x={134} y={58} text="Zzz" size={16} fill="#c8baff" rot={-8} />
      <At x={70} y={22} s={0.9}>
        <Fang />
      </At>
      <At x={96} y={22} s={0.9}>
        <Fang />
      </At>
      <Plus x={60} y={120} color="#2fa862" />
    </g>
  ),
  d_curse: (p) => (
    <g>
      <Stage p={p} dark />
      <At x={110} y={84} r={18}>
        <Claws p={p} color={p.light} />
      </At>
      <At x={50} y={50} s={0.6}>
        <Wisp p={p} />
      </At>
    </g>
  ),
  ch_blackhole: (p) => (
    <g>
      <Stage p={p} dark />
      <At x={100} y={80} s={1.2}>
        <Vortex p={p} />
      </At>
      <Sparkles pts={[[30, 30, 4], [170, 30, 4], [170, 130, 4], [30, 130, 4]]} />
    </g>
  ),
  dark_sig: (p) => (
    <g>
      <Stage p={p} dark />
      <At x={76} y={18} r={-8} s={1.3}>
        <Fang />
      </At>
      <At x={124} y={18} r={8} s={1.3}>
        <Fang />
      </At>
      <At x={100} y={116}>
        <Impact p={p} r={22} />
      </At>
      <At x={156} y={120} s={0.5}>
        <Heart />
      </At>
    </g>
  ),
  d_lullaby: (p) => (
    <g>
      <Stage p={p} dark />
      <At x={60} y={50} s={0.8}>
        <Crescent p={p} />
      </At>
      {[
        [110, 80, -10],
        [150, 50, 10],
        [140, 110, -6],
      ].map(([x, y, r], i) => (
        <At key={i} x={x} y={y} r={r} s={0.9}>
          <g className="ill-float" style={{ animationDelay: `${i * 0.3}s` }}>
            <Note color={i % 2 ? '#c8baff' : '#fff6c2'} />
          </g>
        </At>
      ))}
    </g>
  ),
  d_scramble: (p) => (
    <g>
      <Stage p={p} dark />
      <At x={100} y={80} s={0.9}>
        <Spiral color={p.light} w={5} turns={2} r={60} />
      </At>
      {[
        [64, 70, -20],
        [100, 60, 0],
        [136, 70, 20],
      ].map(([x, y, r], i) => (
        <At key={i} x={x} y={y} r={r}>
          <MiniCard p={p} mark={<text y={10} textAnchor="middle" fontSize={26} fontWeight={900} fill={p.dark}>?</text>} />
        </At>
      ))}
    </g>
  ),
  d_moonpray: (p) => (
    <g>
      <Stage p={p} dark />
      <At x={100} y={40} s={0.8}>
        <Crescent p={p} />
      </At>
      <At x={100} y={110} s={0.8}>
        <PrayHands />
      </At>
      <Plus x={150} y={100} color="#2fa862" />
    </g>
  ),
  d_hex: (p) => (
    <g>
      <Stage p={p} dark />
      <At x={84} y={76}>
        <Star fill={`url(#gv-dark)`} r={46} />
      </At>
      <At x={152} y={96} s={0.5}>
        <BigArrow color="#7b5cf0" down />
      </At>
      <Sparkles pts={[[40, 30], [160, 30]]} fill="#c8baff" />
    </g>
  ),

  // ============================== ほじょ
  sh_counter: (p) => (
    <g>
      <Stage p={p} />
      <At x={80} y={82} s={0.9}>
        <Shield face={p} />
      </At>
      <At x={150} y={56} r={200} s={0.8}>
        <Arrow len={80} />
      </At>
      <At x={150} y={110} r={160} s={0.8}>
        <Arrow len={80} />
      </At>
      <At x={122} y={82}>
        <Burst x={0} y={0} r={12} p={Elec} points={9} />
      </At>
    </g>
  ),
  c_roll: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={84}>
        <Barrier p={p} r={66} />
      </At>
      <At x={100} y={84}>
        <Ball p={p} r={36} />
      </At>
      <path d="M76,84 C80,64 120,64 124,84" fill="none" stroke={p.dark} strokeWidth={3} />
      <Plus x={160} y={36} color="#2fa862" />
    </g>
  ),
  c_dodge: (p) => (
    <g>
      <Stage p={p} />
      <At x={86} y={84} s={0.9}>
        <Shield face={p} />
      </At>
      <At x={156} y={82} s={0.55}>
        <BigArrow color="#2f7dd1" />
      </At>
    </g>
  ),
  ca_breath: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={80}>
        <Aura p={p} r={66} />
      </At>
      {[0, 1, 2].map((i) => (
        <g key={i} className="ill-float" style={{ animationDelay: `${i * 0.3}s` }}>
          <path d={`M30,${50 + i * 30} C60,${30 + i * 30} 140,${70 + i * 30} 170,${46 + i * 30}`} fill="none" stroke={INK} strokeWidth={10} strokeLinecap="round" />
          <path d={`M30,${50 + i * 30} C60,${30 + i * 30} 140,${70 + i * 30} 170,${46 + i * 30}`} fill="none" stroke="#c9f0dd" strokeWidth={6} strokeLinecap="round" />
        </g>
      ))}
      <Plus x={100} y={80} s={2.2} color="#2fa862" />
    </g>
  ),
  u_detox: (p) => (
    <g>
      <Stage p={p} />
      <At x={70} y={100} o={0.45}>
        <PoisonCloud s={0.8} />
      </At>
      {[
        [110, 60, 18],
        [150, 90, 12],
        [130, 30, 9],
        [90, 110, 10],
      ].map(([x, y, r], i) => (
        <Bubble key={i} x={x} y={y} r={r} delay={i * 0.2} />
      ))}
      <Sparkles pts={[[40, 30], [170, 130]]} />
    </g>
  ),
  c_onigiri: (p) => (
    <g>
      <Stage p={p} lines={false} />
      <At x={100} y={84} s={1.2}>
        <Onigiri />
      </At>
      <Plus x={164} y={36} color="#2fa862" />
      <Sparkles pts={[[36, 40], [166, 130, 5]]} />
    </g>
  ),
  c_rest: (p) => (
    <g>
      <Stage p={p} lines={false} />
      <At x={100} y={92} s={1.2}>
        <Tea p={p} />
      </At>
    </g>
  ),
  c_lunch: (p) => (
    <g>
      <Stage p={p} lines={false} />
      <At x={100} y={86} s={1.3}>
        <Bento />
      </At>
      <Sparkles pts={[[30, 30], [170, 30]]} />
    </g>
  ),
  c_focus: () => (
    <g>
      <Stage p={Atk} />
      <At x={100} y={84}>
        <Aura p={Atk} r={72} />
      </At>
      <At x={100} y={84} s={1}>
        <BigArrow color="#e8503a" />
      </At>
      <Sparkles pts={[[40, 30], [160, 30]]} fill="#ffe27a" />
    </g>
  ),
  wg_flap: (p) => (
    <g>
      <Stage p={P.water} />
      <At x={70} y={80} sx={-1} s={1}>
        <Wing p={P.water} />
      </At>
      <At x={130} y={80}>
        <Wing p={P.water} />
      </At>
      <At x={100} y={136} r={0}>
        <Streaks n={3} len={40} gap={8} />
      </At>
      <Sparkles pts={[[100, 30]]} />
      {void p}
    </g>
  ),
  ey_read: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={80} s={1.2}>
        <Eye p={P.bolt} />
      </At>
      <Sparkles pts={[[40, 30], [160, 30], [170, 130, 5]]} fill="#fff07a" />
    </g>
  ),
  c_wish: (p) => (
    <g>
      <Stage p={P.kosei} dark />
      <At x={100} y={78} s={1.3}>
        <Star />
      </At>
      <Sparkles pts={[[40, 30], [160, 30], [40, 130, 5], [160, 130, 5]]} fill="#fff6c2" />
      {void p}
    </g>
  ),
  c_gather: (p) => (
    <g>
      <Stage p={p} cx={160} cy={60} />
      <At x={96} y={92} r={-24} s={1.3}>
        <Arrow len={120} color="url(#gv-gold)" />
      </At>
      <At x={166} y={52}>
        <Star r={22} />
      </At>
    </g>
  ),
  c_ward: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={84} s={1.1}>
        <Charm p={Atk} />
      </At>
      <Sparkles pts={[[40, 40], [160, 40]]} />
    </g>
  ),
  ey_glare: (p) => (
    <g>
      <Stage p={P.dark} dark />
      <At x={100} y={80} s={1.25}>
        <Eye p={Atk} angry />
      </At>
      {void p}
    </g>
  ),
  ta_look: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={50} s={0.9}>
        <Eye p={P.water} />
      </At>
      <At x={100} y={116} s={0.5}>
        <BigArrow color="#2f7dd1" down />
      </At>
    </g>
  ),
  bg_roar: (p) => (
    <g>
      <Stage p={Atk} cx={140} cy={80} />
      <At x={100} y={84} s={1.2}>
        <Roar p={Atk} />
      </At>
      {void p}
    </g>
  ),
  f_rain: (p) => (
    <g>
      <Stage p={Water} cx={100} cy={40} />
      <At x={100} y={34} s={1.5}>
        <StormCloud />
      </At>
      <At x={100} y={110}>
        <Rain />
      </At>
      {void p}
    </g>
  ),
  f_sun: () => (
    <g>
      <Stage p={Fire} />
      <At x={100} y={80} s={1.2}>
        <Sun />
      </At>
    </g>
  ),
  f_thunder: () => (
    <g>
      <Stage p={Elec} cx={100} cy={40} dark />
      <At x={100} y={50} s={1.6}>
        <StormCloud />
      </At>
      <At x={70} y={116} r={10} s={0.6}>
        <Bolt />
      </At>
      <At x={130} y={120} r={-6} s={0.55}>
        <Bolt />
      </At>
    </g>
  ),
  f_night: () => (
    <g>
      <rect width={200} height={160} fill="#1e1640" />
      <At x={110} y={74} s={1.1}>
        <Crescent p={Dark} />
      </At>
      <Sparkles pts={[[30, 30], [60, 110], [170, 40], [160, 130, 5], [40, 70, 4], [180, 90, 4]]} fill="#fff6c2" />
    </g>
  ),
  br_sub: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={84}>
        <Barrier p={P.water} r={66} />
      </At>
      <At x={100} y={86} s={1}>
        <Heart fill="#ff9bb0" />
      </At>
      <path d="M100,70 L94,82 L102,88 L96,100" fill="none" {...ink(2.6)} />
    </g>
  ),
  br_magic: (p) => (
    <g>
      <Stage p={P.kosei} />
      <At x={100} y={80}>
        <Barrier p={P.kosei} r={70} />
      </At>
      <At x={100} y={80}>
        <Star r={30} fill="url(#gv-kosei)" />
      </At>
      {void p}
    </g>
  ),
  br_ice: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={84}>
        <Barrier p={p} r={66} />
      </At>
      {[60, 84, 108, 132].map((x, i) => (
        <At key={x} x={x + 4} y={30 + (i % 2) * 8} s={0.9}>
          <Icicle h={90} w={24} />
        </At>
      ))}
    </g>
  ),
  tm_bomb: (p) => (
    <g>
      <Stage p={P.dark} />
      <At x={100} y={90} s={1.2}>
        <Bomb p={P.dark} />
      </At>
      {void p}
    </g>
  ),
  tm_trap: (p) => (
    <g>
      <Stage p={p} cx={100} cy={110} />
      <path d="M0,104 Q100,94 200,104 L200,160 L0,160Z" fill="#c9b79a" {...ink(2.4)} />
      {[
        [40, 124, 0.9, 10],
        [80, 112, 1.1, -20],
        [120, 128, 1, 40],
        [160, 114, 0.9, 0],
        [100, 146, 0.8, 70],
        [60, 146, 0.8, 30],
      ].map(([x, y, s, r], i) => (
        <At key={i} x={x} y={y} r={r} s={s}>
          <Caltrop />
        </At>
      ))}
      <Sparkles pts={[[60, 40], [150, 50]]} />
    </g>
  ),
  tm_gift: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={92} s={1.1}>
        <Gift p={Atk} />
      </At>
      <Sparkles pts={[[40, 30], [160, 36], [170, 130, 5]]} />
    </g>
  ),
  sc_life: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={80}>
        <Aura p={p} r={72} />
      </At>
      <At x={100} y={80} s={1.4}>
        <Heart />
      </At>
      <path d="M96,52 L88,72 L102,80 L92,104" fill="none" {...ink(3.2)} />
      <At x={154} y={40}>
        <Impact p={p} r={20} />
      </At>
    </g>
  ),
  sc_bond: (p) => (
    <g>
      <Stage p={P.dark} dark />
      <At x={100} y={80} s={1.2}>
        <Bond p={Atk} q={P.dark} />
      </At>
      {void p}
    </g>
  ),
  sc_endure: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={86}>
        <Aura p={Atk} r={66} />
      </At>
      <At x={100} y={86} s={1.3}>
        <Heart />
      </At>
      <rect x={70} y={70} width={60} height={14} rx={4} fill="#fffdf5" transform="rotate(-20 100 77)" {...ink(2.4)} />
    </g>
  ),
  cp_copy: (p) => (
    <g>
      <Stage p={P.kosei} />
      <At x={100} y={74} s={1.1}>
        <Mirror p={P.water} />
      </At>
      <Sparkles pts={[[40, 40], [160, 40]]} />
      {void p}
    </g>
  ),
  cp_nobig: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={76} s={1.2}>
        <Star r={40} />
      </At>
      <At x={100} y={76} r={-20}>
        <Chain />
      </At>
      <At x={130} y={110} s={0.8}>
        <Lock />
      </At>
    </g>
  ),
  cp_noguard: (p) => (
    <g>
      <Stage p={p} />
      <At x={96} y={78} s={0.9}>
        <Shield face={Water} />
      </At>
      <At x={100} y={78} r={20}>
        <Chain />
      </At>
      <At x={136} y={114} s={0.8}>
        <Lock />
      </At>
    </g>
  ),
  sw_heart: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={80} s={1.1}>
        <Swap p={Atk} q={Water} />
      </At>
      <At x={56} y={80} s={0.7}>
        <Heart />
      </At>
      <At x={144} y={80} s={0.7}>
        <Heart fill="#8ac6ff" />
      </At>
    </g>
  ),
  sw_dump: (p) => (
    <g>
      <Stage p={p} cx={160} cy={70} />
      <At x={70} y={90}>
        <PoisonCloud s={0.9} />
      </At>
      <At x={130} y={70} r={-20} s={1}>
        <Arrow len={110} color="#a77ae0" fletch="#a77ae0" />
      </At>
    </g>
  ),
  sw_steal: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={80} s={1.1}>
        <Swap p={Atk} q={Sup} />
      </At>
      <At x={100} y={80} s={0.6}>
        <Star />
      </At>
    </g>
  ),
  gm_coin: () => (
    <g>
      <Stage p={P.bolt} />
      <At x={100} y={78} s={1.2}>
        <Coin />
      </At>
      <path d="M60,140 C70,110 80,100 90,98" fill="none" stroke="#33302b" strokeWidth={2.4} strokeDasharray="5 6" />
      <Sparkles pts={[[40, 30], [160, 30], [170, 130, 5]]} fill="#fff6c2" />
    </g>
  ),
  gm_all: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={86} s={1.2}>
        <Bomb p={Atk} />
      </At>
      <At x={150} y={40}>
        <Impact p={Atk} r={22} />
      </At>
      <Sfx x={46} y={40} text="!?" size={32} fill="#ffe27a" rot={-10} />
    </g>
  ),
  fc_taunt: (p) => (
    <g>
      <Stage p={Atk} />
      <At x={96} y={84} s={1.2}>
        <Roar p={Fire} />
      </At>
      <At x={160} y={44}>
        <Impact p={Atk} r={16} />
      </At>
      {void p}
    </g>
  ),
  fc_read: (p) => (
    <g>
      <Stage p={p} />
      <At x={100} y={96} s={0.8}>
        <Shield face={p} />
      </At>
      <At x={100} y={34} s={0.65}>
        <Eye p={Elec} />
      </At>
    </g>
  ),
};

void Halo;
void Rings;
void Sword;
void Fireball;
void Vortex;
void Wood;
