import { newEngine, ok, eq } from './_helpers.js';
import { slotPos } from '../../../mobile-native/src/game/engine.js';
import C from '../../../mobile-native/src/core/starchef-core.js';
const tap = (eng, k, i) => eng.tapBoard(...slotPos(k, i));

export const name = 'TC-11 黑洞双态';
export async function run() {
  const eng = await newEngine();
  eng.startLevel(9);                       // 终章：订单=太阳+黑洞
  eng.S.board[1][0] = { t: 13, born: 0 }; eng.S.board[1][1] = { t: 13, born: 0 };
  // 在黑洞落点的邻近槽预置一个牺牲天体
  const tgt = C.migraTarget(eng.S.board, 1, 0);
  const nb = C.neighborSlots(tgt[0], tgt[1]).find(([kk, jj]) => !eng.S.board[kk][jj]);
  eng.S.board[nb[0]][nb[1]] = { t: 2, born: 0 };
  const loss0 = eng.S.loss;
  eng.S._resoTmp = 0; eng.resolveFx();
  const flat = eng.S.board.flat().filter(Boolean);
  ok(flat.some(b => b.t === 14), '双太阳应合成黑洞');
  ok(eng.S.loss >= C.mass(2), '吞噬邻近应计损失（含预置牺牲体）');
  // 常规关：黑洞不可交付
  eng.startLevel(0);
  eng.S.board[0][0] = { t: 14, born: 0 };
  ok(!eng.deliver(0, 0), '常规关黑洞不可交付');
  // 终章：黑洞可交付
  eng.startLevel(9);
  eng.S.board[0][0] = { t: 14, born: 0 };
  ok(eng.deliver(0, 0), '终章黑洞应可交付');
  eq(eng.S.order.find(o => o.tier === 14).delivered, 1, '终章订单计数');
  return {};
}
