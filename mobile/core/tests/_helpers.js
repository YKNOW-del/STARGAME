/** 公共：内存存储 + 引擎工厂 */
export function memStorage() {
  let data = null;
  return { async load() { return data; }, async persist(s) { data = JSON.parse(JSON.stringify(s)); } };
}
export async function newEngine() {
  const { makeEngine } = await import('../../../mobile-native/src/game/engine.js');
  const eng = makeEngine(memStorage());
  await eng.init();
  return eng;
}
export function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ' 期望 ' + b + ' 实得 ' + a); }
export function ok(v, msg) { if (!v) throw new Error(msg || '断言失败'); }
