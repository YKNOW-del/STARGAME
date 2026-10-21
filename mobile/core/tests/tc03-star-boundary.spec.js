
import { ok, eq } from './_helpers.js';
import C from '../../../mobile-native/src/core/starchef-core.js';
export const name = 'TC-03 三星边界';
export async function run() {
  const lv = { maxDrops: 30, maxLossKg: 1e20 };
  eq(C.starCount(30, 0, lv), 3, '双达标=3星');
  eq(C.starCount(31, 0, lv), 2, '投放超标=2星');
  eq(C.starCount(30, 2e20, lv), 2, '损失超标=2星');
  eq(C.starCount(31, 2e20, lv), 1, '双超标=1星');
  return { info: '阈值 30/1e20' };
}
