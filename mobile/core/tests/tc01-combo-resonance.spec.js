import { newEngine, ok, eq } from './_helpers.js';
import { slotPos } from '../../../mobile-native/src/game/engine.js';
import C from '../../../mobile-native/src/core/starchef-core.js';
const tap = (eng, k, i) => eng.tapBoard(...slotPos(k, i));
export const name = 'TC-01 连锁与共振';
export async function run() {
  const eng = await newEngine();
  eng.startLevel(0);
  // 单次合成（两颗相邻小行星）→ 无共振
  eng.S.pool = [2, 2, 2]; tap(eng, 0, 0);
  eng.S.pool = [2, 2, 2]; tap(eng, 0, 1);
  eq(eng.S.drops, 2, '投放数');
  ok(eng.S.score === 0, '单次合成不应有共振');
  // 连锁：0 轨两颗 t0 + 预置对位使产物继续配对 → 至少 2 连
  eng.startLevel(0);
  eng.S.board = C.newBoard();
  eng.S.board[0][0] = { t: 0 }; eng.S.board[0][1] = { t: 0 };   // 星尘对 → 彗星(t1) 外迁
  eng.S.board[1][2] = { t: 1 }; eng.S.board[1][3] = { t: 1 };   // 彗星对 → 小行星(t2) 外迁
  eng.S._resoTmp = 0;
  eng.afterAction();
  const flat = eng.S.board.flat().filter(Boolean);
  ok(flat.some(b => b.t === 2), '应有 t2 产物');
  ok(eng.S.score > 0, '连锁≥2 应计入共振奖励');
  return { info: '共振=' + eng.S.score.toExponential(1) + ' kg' };
}
