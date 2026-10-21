import { newEngine, ok, eq } from './_helpers.js';
import { slotPos } from '../../../mobile-native/src/game/engine.js';
import C from '../../../mobile-native/src/core/starchef-core.js';
const tap = (eng, k, i) => eng.tapBoard(...slotPos(k, i));

export const name = 'TC-02 引力崩溃判定';
export async function run() {
  const eng = await newEngine();
  eng.startLevel(0);
  // 满盘、无匹配可交付、弃置耗尽 → 崩溃
  for (let k = 0; k < 4; k++) for (let i = 0; i < C.ORBITS[k]; i++)
    eng.S.board[k][i] = { t: 1, born: 0 };        // 彗星，订单要 t2 → 不可交付
  eng.S.discard = 0;
  eng.checkEnd();
  ok(['crashing','crash'].includes(eng.MODE), '应进入崩溃，实得 ' + eng.MODE);
  // 弃置尚存则不崩
  eng.S.discard = 1; eng.MODE = 'play'; eng.checkEnd();
  ok(eng.MODE === 'play', '有弃置不应崩溃');
  return {};
}
