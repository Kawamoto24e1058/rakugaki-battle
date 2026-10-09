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

export default function App() {
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
