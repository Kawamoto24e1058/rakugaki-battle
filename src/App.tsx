import { useEffect } from 'react';
import { useGame } from './store/gameStore';
import { TitleScene } from './scenes/TitleScene';
import { BadgePrintScene } from './scenes/BadgePrintScene';
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

  // NPC の 絵は 先に ステッカー画像に しておく（バトル中に つくると カクつく）
  useEffect(() => {
    for (const u of Object.values(NPC_ART)) void stickerOf(u);
  }, []);

  // 場面ごとの BGM（バトルは バトルの 曲、結果は ジングルの あと ホームの 曲）
  useEffect(() => {
    if (screen === 'battle') bgm.play('battle');
    else if (screen === 'result') {
      // ジングルは バトルの おわりの 画面で 鳴らしずみ。のこりが おわったら ホームの 曲
      const t = window.setTimeout(() => bgm.play('home'), 1500);
      return () => window.clearTimeout(t);
    } else if (screen === 'print' || screen === 'badge') bgm.play(null);
    else bgm.play('home');
  }, [screen]);

  switch (screen) {
    case 'title':
      return <TitleScene />;
    case 'print':
      return <PrintTemplateScene />;
    case 'badge':
      return <BadgePrintScene />;
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
