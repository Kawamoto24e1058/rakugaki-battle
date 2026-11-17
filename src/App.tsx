import { useEffect } from 'react';
import { useGame } from './store/gameStore';
import { TitleScene } from './scenes/TitleScene';
import { PrintTemplateScene } from './scenes/PrintTemplateScene';
import { CaptureScene } from './scenes/CaptureScene';
import { RevealScene } from './scenes/RevealScene';
import { OpponentScene } from './scenes/OpponentScene';
import { BattleScene } from './scenes/BattleScene';
import { ResultScene } from './scenes/ResultScene';
import { ZukanScene } from './scenes/ZukanScene';
import { CardGalleryScene } from './scenes/CardGalleryScene';
import { CrayonDefs } from './components/art/CardArt';
import { FxDemo } from './scenes/battle/FxDemo';
import { MinigameDemo } from './minigames/MinigameDemo';
import { bgm } from './audio/bgm';
import { NPC_ART } from './components/art/npcArt';
import { stickerOf } from './components/sticker';
import { CardLab } from './components/art/CardLab';

export default function App() {
  if (import.meta.env.DEV && window.location.search.includes('mg=')) {
    return (
      <>
        <CrayonDefs />
        <MinigameDemo />
      </>
    );
  }
  if (import.meta.env.DEV && window.location.search.includes('cardlab')) {
    return (
      <>
        <CrayonDefs />
        <CardLab />
      </>
    );
  }
  if (import.meta.env.DEV && window.location.search.includes('fxdemo')) {
    return (
      <>
        <CrayonDefs />
        <FxDemo />
      </>
    );
  }
  return (
    <>
      <CrayonDefs />
      <Screens />
    </>
  );
}

function Screens() {
  const screen = useGame((s) => s.screen);
  const lastWon = useGame((s) => s.lastWon);
  const lastDraw = useGame((s) => s.lastDraw);
  const versus = useGame((s) => s.mode === 'versus');

  // NPC の 絵は 先に ステッカー画像に しておく（バトル中に つくると カクつく）
  useEffect(() => {
    for (const u of Object.values(NPC_ART)) void stickerOf(u);
  }, []);

  // 場面ごとの BGM（バトルは バトルの 曲、結果は ジングルの あと ホームの 曲）
  useEffect(() => {
    if (screen === 'battle') bgm.play('battle');
    else if (screen === 'result') {
      // ふたりで あそぶ ときは だれかが かつので かちの ジングル（ひきわけ だけ まけの ほう）
      bgm.jingle(lastDraw || (!versus && lastWon === false) ? 'lose' : 'win');
      const t = window.setTimeout(() => bgm.play('home'), 3200);
      return () => window.clearTimeout(t);
    } else if (screen === 'print') bgm.play(null);
    else bgm.play('home');
  }, [screen, lastWon, lastDraw, versus]);

  switch (screen) {
    case 'title':
      return <TitleScene />;
    case 'print':
      return <PrintTemplateScene />;
    case 'capture':
      return <CaptureScene />;
    case 'reveal':
      return <RevealScene />;
    case 'opponent':
      return <OpponentScene />;
    case 'battle':
      return <BattleScene />;
    case 'result':
      return <ResultScene />;
    case 'zukan':
      return <ZukanScene />;
    case 'cards':
      return <CardGalleryScene />;
    default:
      return <TitleScene />;
  }
}
