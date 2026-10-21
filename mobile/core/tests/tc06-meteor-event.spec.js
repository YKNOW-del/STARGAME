import { newEngine, ok, eq } from './_helpers.js';
import { slotPos } from '../../../mobile-native/src/game/engine.js';
import C from '../../../mobile-native/src/core/starchef-core.js';
const tap = (eng, k, i) => eng.tapBoard(...slotPos(k, i));

export const name = 'TC-06 陨石事件';
export async function run() {
  const eng = await newEngine();
  eng.startLevel(1);                       // meteor=32s
  eng.S.board[0][0] = { t: 2, born: 0 };   // 小行星
  eng.S.nextMeteorAt = eng.S.time + 0.01;
  let seen = false;
  const off = eng.on((t2) => { if (t2 === 'warn') seen = true; });
  for (let i = 0; i < 60 && eng.S.warns.length === 0; i++) eng.tick(0.05);
  ok(seen && eng.S.warns.length > 0, '应出现预警');
  const w = eng.S.warns[0];
  ok(Math.abs((w.impact - w.start) - 3) < 1e-6, '预警 3 秒');
  const loss0 = eng.S.loss;
  for (let i = 0; i < 60 && eng.S.warns.length > 0; i++) eng.tick(0.06);
  ok(eng.S.loss > loss0, '命中降级应累计损失');
  off();
  return { info: '损失 +' + (eng.S.loss - loss0).toExponential(1) };
}
