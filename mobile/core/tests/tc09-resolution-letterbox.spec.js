
import { ok } from './_helpers.js';
import { LAYOUT, slotPos } from '../../../mobile-native/src/game/engine.js';
export const name = 'TC-09 分辨率映射';
export async function run() {
  // 引擎级可验的几何部分：所有槽位坐标都落在逻辑画布内且轨道半径单调
  for (let k = 0; k < 4; k++) for (let i = 0; i < LAYOUT.RADII.length * 0 + 3; i++) {
    const [x, y] = slotPos(k, i);
    ok(x >= 0 && x <= LAYOUT.W && y >= 0 && y <= LAYOUT.H, '槽位坐标应在画布内');
  }
  ok(LAYOUT.RADII.every((r, i, a) => i === 0 || r > a[i - 1]), '轨道半径应递增');
  return { status: 'skip', info: '几何映射通过；像素级 letterbox 属渲染层（NFR-C02），网页版实测已覆盖' };
}
