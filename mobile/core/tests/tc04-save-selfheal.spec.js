
import { ok } from './_helpers.js';
import { makeEngine } from '../../../mobile-native/src/game/engine.js';
export const name = 'TC-04 存档自愈';
export async function run() {
  // load 返回损坏结构（缺 unlocked）→ 回退默认档，不抛异常
  const bad = { async load() { return { stars: 'corrupt', no: true }; }, async persist() {} };
  const eng = makeEngine(bad);
  const s = await eng.init();
  ok(s && typeof s.unlocked === 'number', '损坏档应回退默认（unlocked=1）');
  ok(s.unlocked === 1, 'unlocked 应为 1');
  return {};
}
