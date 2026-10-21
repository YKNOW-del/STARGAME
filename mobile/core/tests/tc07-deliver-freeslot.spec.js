import { newEngine, ok, eq } from './_helpers.js';
import { slotPos } from '../../../mobile-native/src/game/engine.js';
import C from '../../../mobile-native/src/core/starchef-core.js';
const tap = (eng, k, i) => eng.tapBoard(...slotPos(k, i));

export const name = 'TC-07 交付腾槽';
export async function run() {
  const eng = await newEngine();
  eng.startLevel(0);                       // 订单：小行星×2
  eng.S.pool = [2, 2, 2]; tap(eng, 0, 0);
  ok(eng.S.board[0][0], '应已投放');
  const s0 = eng.S.score;
  tap(eng, 0, 0);                          // 点击同一天体 → 交付
  ok(!eng.S.board[0][0], '交付后槽位应腾空');
  eq(eng.S.order[0].delivered, 1, '订单计数');
  eq(eng.S.score - s0, C.mass(2), '得分=小行星质量');
  return {};
}
