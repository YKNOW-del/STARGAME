
import { ok } from './_helpers.js';
import { makeEngine } from '../../../mobile-native/src/game/engine.js';
export const name = 'TC-05 存储不可用降级';
export async function run() {
  const throwing = { async load() { throw new Error('localStorage disabled'); }, async persist() { throw new Error('full'); } };
  const eng = makeEngine(throwing);
  const s = await eng.init();
  ok(s && s.unlocked === 1, '存储抛异常应回退默认档');
  eng.startLevel(0);
  ok(eng.S && eng.S.board, '应能正常开局（内存态运行）');
  return {};
}
