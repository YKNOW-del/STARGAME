
import { ok } from './_helpers.js';
import C from '../../../mobile-native/src/core/starchef-core.js';
export const name = 'TC-12 逻辑层性能基准（NFR-P02 等效）';
export async function run() {
  const board = C.newBoard();
  for (let k = 0; k < 4; k++) for (let i = 0; i < C.ORBITS[k]; i += 2)
    board[k][i] = { t: (k * 3 + i) % 9, born: 0 };   // 大量可配对天体
  const N = 2000;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    const b2 = JSON.parse(JSON.stringify(board));
    C.resolveBoard(b2);
  }
  const per = (performance.now() - t0) / N;
  ok(per < 16, '单次 resolve 平均应 <16ms（NFR-P02），实得 ' + per.toFixed(3) + 'ms');
  return { info: 'resolveBoard 平均 ' + per.toFixed(3) + ' ms × ' + N + ' 次' };
}
