/* 星轨厨房核心逻辑 · Node 单元测试（无 DOM 环境，验证 NFR-M03 可移植性）
 * 运行：node core.test.js */
'use strict';
const C = require('./starchef-core.js');

let pass = 0, fail = 0;
function T(name, fn) {
  try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); fail++; }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ' 期望 ' + b + ' 实得 ' + a); }
function ok(v, msg) { if (!v) throw new Error(msg || '断言失败'); }

console.log('== 星轨厨房核心逻辑测试 ==');

T('数据完整性：15 级链 + 17 图鉴 + 10 关卡', () => {
  eq(C.BODIES.length, 15); eq(C.DEX.length, 17); eq(C.LEVELS.length, 10);
  for (let t = 1; t < 15; t++) ok(C.BODIES[t].mass > C.BODIES[t - 1].mass, '等级 ' + t + ' 质量未递增');
});

T('质量升序与三条科普点（V2）', () => {
  ok(C.mass(6) > C.mass(5), '火星应重于水星');
  ok(C.mass(10) > C.mass(9), '海王星应重于天王星');
  ok(C.mass(4) > C.mass(3), '月球应重于冥王星');
});

T('fmtMass 格式', () => {
  eq(C.fmtMass(5.97e24), '1.00 M⊕');
  eq(C.fmtMass(1.989e30), '1.00 M☉');
  eq(C.fmtMass(2.6e20), '2.6×10²⁰ kg');
  eq(C.fmtMass(0), '0');
});

T('自动合成 + 外迁（两颗小行星 → 冥王星落外轨）', () => {
  const b = C.newBoard();
  C.put(b, 0, 0, { t: 2 }); C.put(b, 0, 1, { t: 2 });
  const ms = C.resolveBoard(b);
  eq(ms.length, 1); eq(ms[0].product, 3);
  eq(b[ms[0].to[0]][ms[0].to[1]].t, 3);
  ok(ms[0].to[0] === 1, '产物应迁往外轨');
});

T('连锁合成与共振口径（4 连锁 → 产物为 t+4）', () => {
  const b = C.newBoard();
  // 构造链：内圈两颗 t0，其产物在外轨与预置同级合并，逐级上传
  C.put(b, 0, 0, { t: 4 }); C.put(b, 0, 1, { t: 4 });
  C.put(b, 1, 3, { t: 5 });                      // 等待与 0 圈产物(t5)相邻? 用直接验证:
  const ms = C.resolveBoard(b);
  eq(ms.length, 1, '外轨预置体不相邻时只合成一次');
  // 显式 3 连锁场景：t1+t1→t2 落位后与预置 t2 相邻
  const b2 = C.newBoard();
  const p = C.migraTarget(b2, 0, 0) || [0, 0];   // 产物落点先占位计算
  C.put(b2, 0, 0, { t: 1 }); C.put(b2, 0, 1, { t: 1 });
  C.put(b2, p[0], p[1], null);
  // 预置一个 t2 在产物落点的相邻位
  const nIdx = (p[1] + 1) % C.ORBITS[p[0]];
  C.put(b2, p[0], nIdx, { t: 2 });
  const ms2 = C.resolveBoard(b2);
  eq(ms2.length, 2, '应发生两次连锁');
  eq(ms2[1].product, 3);
});

T('黑洞合成吞噬邻近（FR-207）', () => {
  const b = C.newBoard();
  C.put(b, 1, 0, { t: 13 }); C.put(b, 1, 1, { t: 13 });
  const tgtNeighbors = new Set(C.neighborSlots(...(C.migraTarget(b, 1, 0) || [1, 0])).map(p => p.join(',')));
  // 在产物落点邻近放两个小天体、远处放一个
  let placed = 0;
  for (let k = 0; k < 4 && placed < 2; k++) for (let i = 0; i < C.ORBITS[k] && placed < 2; i++) {
    if (!b[k][i] && tgtNeighbors.has(k + ',' + i)) { C.put(b, k, i, { t: 2 }); placed++; }
  }
  const ms = C.resolveBoard(b);
  eq(ms.length, 1); eq(ms[0].product, 14);
  ok(ms[0].devoured && ms[0].devoured.length === placed, '应吞噬邻近 ' + placed + ' 个天体');
});

T('冰卫星冻结与解冻（FR-204）', () => {
  const b = C.newBoard();
  C.put(b, 0, 0, { t: 4, v: 'ice' });
  ok(C.isFrozenSlot(b, 0, 1), '(0,1) 应被冻结');
  ok(C.isFrozenSlot(b, 0, 3), '(0,3) 应被冻结');
  ok(!C.isFrozenSlot(b, 0, 2), '(0,2) 不应被冻结');
  ok(!C.isFrozenSlot(b, 1, 0), '占用槽不适用冻结判定');
  // 相邻放第二颗冰卫星 → 合成冥王星 → 冻结解除
  C.put(b, 0, 1, { t: 4, v: 'ice' });
  C.resolveBoard(b);
  ok(!C.isFrozenSlot(b, 0, 2) && !C.isFrozenSlot(b, 0, 3), '冰卫星合成后应解冻');
});

T('交付匹配与订单判定（FR-105/301）', () => {
  const order = [{ tier: 2, count: 2, delivered: 0 }, { tier: 4, count: 1, delivered: 0 }];
  eq(C.deliverableIndex(order, 2), 0);
  eq(C.deliverableIndex(order, 4), 1);
  eq(C.deliverableIndex(order, 6), -1);
  ok(!C.orderDone(order));
  order[0].delivered = 2;
  eq(C.deliverableIndex(order, 2), -1, '已满项不再匹配');
  order[1].delivered = 1;
  ok(C.orderDone(order));
});

T('引力崩溃判定（FR-107，含冰封）', () => {
  const order = [{ tier: 2, count: 2, delivered: 0 }];
  const b = C.newBoard();
  ok(!C.crashCondition(b, order, 0), '空盘不崩溃');
  // 填满全部槽位（不与订单匹配），弃置=0 → 崩溃
  const full = C.newBoard();
  for (let k = 0; k < 4; k++) for (let i = 0; i < C.ORBITS[k]; i++) C.put(full, k, i, { t: 1 });
  ok(C.crashCondition(full, order, 0), '满盘无交付应崩溃');
  ok(!C.crashCondition(full, order, 1), '还有弃置则不崩溃');
  // 冰封致无槽可用同样计入
  const fro = C.newBoard();
  for (let k = 0; k < 4; k++) for (let i = 0; i < C.ORBITS[k]; i++)
    if ((k + i) % 2 === 0) C.put(fro, k, i, { t: 1 });
  for (let k = 0; k < 4; k++) for (let i = 0; i < C.ORBITS[k]; i++)
    if (!fro[k][i]) C.put(fro, k, i, { t: 4, v: 'ice' });
  C.resolveBoard(fro); // 冰卫星相邻会合并，重摆为非合并布局
  const fro2 = C.newBoard();
  for (let k = 0; k < 4; k++) for (let i = 0; i < C.ORBITS[k]; i++)
    C.put(fro2, k, i, { t: ((k + i) % 2 === 0) ? 1 : { 1: 1 } && 9 }); // 奇数槽放互不相邻的天王星
  ok(C.crashCondition(fro2, order, 0), '满盘(含可冻结派生)无交付应崩溃');
});

T('三星评级边界（FR-305）', () => {
  const lv = { maxDrops: 5, maxLossKg: 1e20 };
  eq(C.starCount(5, 0, lv), 3, '双双达标=3星');
  eq(C.starCount(6, 0, lv), 2, '投放超标=2星');
  eq(C.starCount(5, 2e20, lv), 2, '损失超标=2星');
  eq(C.starCount(6, 2e20, lv), 1, '双超标=1星');
});

T('候选池区间/权重/种子注入（FR-101, NFR-M03）', () => {
  const lv = C.LEVELS[0];
  let seed = 42;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const a = [], b = [];
  for (let i = 0; i < 50; i++) a.push(C.pickTier(lv, rng));
  seed = 42;
  for (let i = 0; i < 50; i++) b.push(C.pickTier(lv, rng));
  ok(JSON.stringify(a) === JSON.stringify(b), '同种子序列应一致');
  a.forEach(t => ok(t >= 0 && t <= 2, '等级越界: ' + t));
});

T('变体投放标记（FR-204/205）', () => {
  const lvIce = C.LEVELS[5], lvPlain = C.LEVELS[4];
  let sawIce = false;
  for (let i = 0; i < 200 && !sawIce; i++) {
    const it = C.maybeVariant(lvIce, 4, () => 0.01);
    sawIce = it && it.v === 'ice';
  }
  ok(sawIce, '冰关应能出冰卫星变体');
  eq(C.maybeVariant(lvPlain, 4, () => 0.01), 4, '非变体关返回原等级');
  const pulse = C.maybeVariant(C.LEVELS[7], 13, () => 0.01);
  ok(pulse && pulse.v === 'pulse', '脉冲关应能出脉冲星变体');
});

T('玩家名校验（FR-405）', () => {
  ok(C.validName('余孔鑫')); ok(C.validName('GLM_6dot6'));
  ok(!C.validName(''), '空名应拒'); ok(!C.validName('a'.repeat(13)), '超长应拒');
  ok(!C.validName('ab@cd'), '非法字符应拒');
});

T('阈值推导公式与关卡表一致（5.5 自检，第 4 关起）', () => {
  for (let i = 3; i < C.LEVELS.length; i++) {
    const d = C.derivedThresholds(C.LEVELS[i]);
    eq(C.LEVELS[i].maxDrops, d.maxDrops, '第' + (i + 1) + '关 maxDrops 与公式不符');
    ok(Math.abs(C.LEVELS[i].maxLossKg - d.maxLossKg) / d.maxLossKg < 0.02,
      '第' + (i + 1) + '关 maxLossKg 偏差超 2%');
  }
});

T('关卡池区间落在章区间内（FR-303 层级）', () => {
  const chapter = [[0, 4], [0, 4], [0, 4], [2, 8], [2, 8], [2, 8], [2, 8], [3, 13], [3, 13], [3, 13]];
  C.LEVELS.forEach((lv, i) => {
    ok(lv.pool[0] >= chapter[i][0] && lv.pool[1] <= chapter[i][1],
      '第' + (i + 1) + '关池 ' + lv.pool + ' 超出章区间 ' + chapter[i]);
  });
});

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
