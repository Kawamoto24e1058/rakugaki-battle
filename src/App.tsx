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
