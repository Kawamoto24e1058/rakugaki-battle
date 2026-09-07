import { useGame } from './store/gameStore';
import { TitleScene } from './scenes/TitleScene';
import { CaptureScene } from './scenes/CaptureScene';
import { RevealScene } from './scenes/RevealScene';
import { OpponentScene } from './scenes/OpponentScene';
import { BattleScene } from './scenes/BattleScene';
import { RewardScene } from './scenes/RewardScene';
import { ResultScene } from './scenes/ResultScene';
import { ZukanScene } from './scenes/ZukanScene';

export default function App() {
  const screen = useGame((s) => s.screen);

  switch (screen) {
    case 'title':
      return <TitleScene />;
    case 'capture':
      return <CaptureScene />;
    case 'reveal':
      return <RevealScene />;
    case 'opponent':
      return <OpponentScene />;
    case 'battle':
      return <BattleScene />;
    case 'reward':
      return <RewardScene />;
    case 'result':
      return <ResultScene />;
    case 'zukan':
      return <ZukanScene />;
    default:
      return <TitleScene />;
  }
}
