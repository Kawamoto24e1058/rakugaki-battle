import type { ClashEvent, Side } from '../../engine';

export interface RecapSide {
  /** つかったわざ。うごけなかったなら null。 */
  move: string | null;
  /** うごけなかった理由など。 */
  note: string | null;
  dealt: number;
  taken: number;
  healed: number;
  effects: string[];
}

/** 1ターンぶんのイベントから「だれが何をして、どうなったか」をまとめる。 */
export function buildRecap(events: ClashEvent[], jpOf: (k: string) => string): [RecapSide, RecapSide] {
  const mk = (): RecapSide => ({ move: null, note: null, dealt: 0, taken: 0, healed: 0, effects: [] });
  const r: [RecapSide, RecapSide] = [mk(), mk()];
  let actor: Side | null = null;
  for (const ev of events) {
    switch (ev.t) {
      case 'act':
        actor = ev.side;
        if (ev.kind === 'blocked') r[ev.side].note = ev.moveName.replace(/[（）]/g, '');
        else if (ev.kind === 'charge') r[ev.side].move = `${ev.moveName}（ため）`;
        else r[ev.side].move = ev.moveName;
        break;
      case 'damage':
        r[ev.side].taken += ev.amount;
        if (actor != null && actor !== ev.side) r[actor].dealt += ev.amount;
        break;
      case 'status-tick':
        r[ev.side].taken += ev.amount;
        r[ev.side].effects.push(`${jpOf(ev.kind)}で ${ev.amount}`);
        break;
      case 'heal':
        r[ev.side].healed += ev.amount;
        break;
      case 'status-apply':
        if (ev.kind !== 'charging') r[ev.side].effects.push(jpOf(ev.kind));
        break;
      case 'bonus':
        r[ev.side].effects.push(ev.label);
        break;
      default:
        break;
    }
  }
  return r;
}

const SIDE_COLOR = ['#e8503a', '#2f7dd1'];

/** 前のターンのけっか（ダメージ・かいふく・効果）。 */
export function TurnRecap({ recap, names }: { recap: [RecapSide, RecapSide]; names: [string, string] }) {
  return (
    <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem' }}>
      {([0, 1] as Side[]).map((s) => {
        const x = recap[s];
        return (
          <div key={s} style={{ border: '2.5px solid var(--ink)', borderRadius: 10, background: '#fffdf5', padding: '0.2rem 0.55rem', display: 'grid', gap: 2, minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: SIDE_COLOR[s], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {names[s]}：{x.move ? `「${x.move}」` : (x.note ?? '…')}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontWeight: 700 }}>
              <span style={{ color: x.dealt ? '#e83a2a' : 'var(--ink-soft)' }}>あたえた {x.dealt}</span>
              <span style={{ color: x.taken ? '#b8402a' : 'var(--ink-soft)' }}>うけた {x.taken}</span>
              {x.healed > 0 && <span style={{ color: '#2f9e58' }}>かいふく +{x.healed}</span>}
            </div>
            {x.effects.length > 0 && <div style={{ color: 'var(--ink-soft)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.effects.join(' / ')}</div>}
          </div>
        );
      })}
    </div>
  );
}
