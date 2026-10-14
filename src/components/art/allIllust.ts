import { ILLUST, type Illust } from './illust';
import { ILLUST2 } from './cards';

/** すべての 描きおろし（見本 8まい ＋ のこり）。 */
export const ALL_ILLUST: Record<string, Illust> = { ...ILLUST2, ...ILLUST };
