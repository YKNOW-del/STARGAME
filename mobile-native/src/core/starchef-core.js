/* 星轨厨房 · 核心逻辑模块（平台无关层）
 * 依据需求文档 NFR-M03（逻辑与渲染分离、无 DOM、可注入随机种子）抽取：
 * 本文件不含任何 DOM / Canvas / storage 依赖，可在 Node、浏览器、Hermes(RN) 等环境运行。
 * 渲染层只依赖 slotAngle 的角度几何（像素映射由各平台壳负责）。
 * UMD：Node 下 module.exports，浏览器下挂 window.StarChef。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StarChef = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- 静态数据 ---------- */
  const BODIES = [
    { name: '星尘',   mass: 0,        c1: '#e0e6ea', c2: '#7a8a99' },
    { name: '彗星',   mass: 1.0e13,   c1: '#c7f2f7', c2: '#37b6c9' },
    { name: '小行星', mass: 2.6e20,   c1: '#ffe3bd', c2: '#a18071' },
    { name: '冥王星', mass: 1.303e22, c1: '#f2ddc0', c2: '#b0927e' },
    { name: '月球',   mass: 7.35e22,  c1: '#f8f8f8', c2: '#8d8d95' },
    { name: '水星',   mass: 3.30e23,  c1: '#e8e2da', c2: '#7c6a58' },
    { name: '火星',   mass: 6.42e23,  c1: '#ffb391', c2: '#c9401a' },
    { name: '金星',   mass: 4.87e24,  c1: '#fff3a6', c2: '#d1a022' },
    { name: '地球',   mass: 5.97e24,  c1: '#8fd7ff', c2: '#1a5fb8' },
    { name: '天王星', mass: 8.68e25,  c1: '#c4fff4', c2: '#12a4b8' },
    { name: '海王星', mass: 1.024e26, c1: '#9ec8ff', c2: '#243a86' },
    { name: '土星',   mass: 5.68e26,  c1: '#fff2c0', c2: '#c98a12' },
    { name: '木星',   mass: 1.898e27, c1: '#ffd2b8', c2: '#b8461d' },
    { name: '太阳',   mass: 1.989e30, c1: '#fffbe0', c2: '#f5a300' },
    { name: '黑洞',   mass: 6.0e30,   c1: '#3a4658', c2: '#000000' },
  ];
  const DEX = [
    { id: 't0',  t: 0,  fact: '行星系的原料——恒星诞生后残余的尘埃盘，一切天体由此汇聚。' },
    { id: 't1',  t: 1,  fact: '彗核是"脏雪球"，来自太阳系边缘的柯伊伯带与奥尔特云，质量取代表性彗核数量级。' },
    { id: 't2',  t: 2,  fact: '质量取灶神星级；大多数小行星分布在火星与木星之间的主带。' },
    { id: 't3',  t: 3,  fact: '2006 年 IAU 决议将其归类为矮行星——它的质量比月球还小。' },
    { id: 't4',  t: 4,  fact: '地球唯一的天然卫星，已被潮汐锁定：永远以同一面朝向我们。' },
    { id: 't5',  t: 5,  fact: '离太阳最近的行星却不是最热的——没有大气保温，昼夜温差超过 600℃。' },
    { id: 't6',  t: 6,  fact: '反直觉事实①：火星的质量大于水星，尽管水星更靠近太阳。' },
    { id: 't7',  t: 7,  fact: '浓厚二氧化碳大气造成失控温室效应，表面温度比水星更高。' },
    { id: 't8',  t: 8,  fact: '目前已知唯一存在生命的行星；它的质量就是计量单位 M⊕。' },
    { id: 't9',  t: 9,  fact: '体积比海王星大，质量却更小；自转轴几乎"躺着"公转。' },
    { id: 't10', t: 10, fact: '反直觉事实②：海王星质量大于天王星——它由数学推算发现，被称为"笔尖上的行星"。' },
    { id: 't11', t: 11, fact: '平均密度小于水——若有足够大的海洋，土星可以浮起来。' },
    { id: 't12', t: 12, fact: '太阳系行星之王，质量约为其余七大行星总和的 2.5 倍。' },
    { id: 't13', t: 13, fact: '占太阳系总质量的 99.86%；M☉ 是天文学另一把标尺。' },
    { id: 't14', t: 14, fact: '恒星级黑洞由大质量恒星坍缩而成，此处取 3 倍太阳质量为代表值。' },
    { id: 'v-ice',   t: 4,  v: 'ice',   name: '冰卫星（变体）', fact: '木卫二等冰卫星表面覆盖冰壳，冰层之下或有液态海洋——落位后会冻结相邻槽位。' },
    { id: 'v-pulse', t: 13, v: 'pulse', name: '脉冲星（变体）', fact: '每秒自转数十次的致密星，射电束像灯塔一样扫过地球——点击可引爆清除同轨小天体。' },
  ];

  // 第 1–3 教学关阈值宽松；第 4 关起 maxDrops=⌈1.5×D_min⌉、maxLossKg=0.2×Σ订单质量（需求文档 5.5）
  const LEVELS = [
    { name: '初生星云', hint: '点候选选天体 → 点轨道空槽投放 · 相邻同级自动合成',
      pool: [0, 2], weights: [3, 2, 2], order: [{ tier: 2, count: 2 }], maxDrops: 6, maxLossKg: 1e21, meteor: 0 },
    { name: '第一份订单', hint: '点金圈天体完成交付 · 陨石有 3 秒红色预警',
      pool: [0, 4], weights: [3, 3, 2, 2, 4], order: [{ tier: 2, count: 2 }, { tier: 4, count: 1 }], maxDrops: 22, maxLossKg: 8e23, meteor: 32 },
    { name: '红色火星', hint: '彗星每 5 秒漂移 · 火星可用月球逐级合成',
      pool: [1, 4], weights: [1, 2, 2, 2, 5], order: [{ tier: 6, count: 2 }, { tier: 4, count: 1 }], maxDrops: 32, maxLossKg: 1.5e24, meteor: 26 },
    { name: '满月之夜', hint: '第二章开幕：三颗月球——直接投放或两颗冥王星合成',
      pool: [2, 4], weights: [2, 3, 5], order: [{ tier: 4, count: 3 }], maxDrops: 5, maxLossKg: 4.41e22, meteor: 24 },
    { name: '内太阳系来客', hint: '第二章：金星需由两颗水星合成',
      pool: [2, 6], weights: [2, 3, 4, 3, 2], order: [{ tier: 7, count: 2 }, { tier: 5, count: 1 }], maxDrops: 8, maxLossKg: 2.01e24, meteor: 24 },
    { name: '冰封卫星', hint: '变体·冰卫星：冻结相邻空槽，合成或交付后解冻',
      pool: [2, 7], weights: [1, 2, 3, 3, 3, 4], order: [{ tier: 8, count: 1 }, { tier: 6, count: 2 }], maxDrops: 6, maxLossKg: 1.45e24, meteor: 22, variants: ['ice'] },
    { name: '类地巡礼', hint: '地球与金星直接在候选池中，陨石更频繁',
      pool: [3, 8], weights: [1, 2, 3, 3, 3, 3], order: [{ tier: 8, count: 2 }, { tier: 7, count: 2 }], maxDrops: 6, maxLossKg: 4.34e24, meteor: 20 },
    { name: '脉冲星之夜', hint: '变体·脉冲星：点击引爆清除同轨小天体 · 终章开幕',
      pool: [5, 11], weights: [2, 2, 3, 3, 3, 2, 2], order: [{ tier: 12, count: 1 }, { tier: 11, count: 2 }], maxDrops: 6, maxLossKg: 6.07e26, meteor: 26, variants: ['pulse'] },
    { name: '冰巨人之海', hint: '木星可直接投放，海王星考验外轨规划',
      pool: [6, 12], weights: [1, 2, 3, 3, 3, 2, 2], order: [{ tier: 12, count: 2 }, { tier: 10, count: 1 }], maxDrops: 5, maxLossKg: 7.8e26, meteor: 24 },
    { name: '恒星演化 · 终章', hint: '最终订单：一颗太阳与一个黑洞——黑洞由两颗太阳合成',
      pool: [8, 13], weights: [2, 2, 2, 3, 2, 1], order: [{ tier: 13, count: 1 }, { tier: 14, count: 1 }], maxDrops: 5, maxLossKg: 1.6e30, meteor: 28 },
  ];

  const ME = 5.972e24, MS = 1.989e30;
  const ORBITS = [4, 6, 8, 10];            // 每圈槽位数
  const OFFS = [0.3, 0.75, 0.15, 0.6];     // 各圈起始角（弧度），像素映射由壳负责

  /* ---------- 工具 ---------- */
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  function sup(n) { return String(n).split('').map(c => SUP[+c]).join(''); }
  function mass(t) { return BODIES[t].mass; }
  function fmtMass(kg) {
    if (kg >= 0.1 * MS) return (kg / MS).toFixed(2) + ' M☉';
    if (kg >= 0.001 * ME) return (kg / ME).toPrecision(3) + ' M⊕';
    if (kg <= 0) return '0';
    const e = Math.floor(Math.log10(kg)), m = (kg / Math.pow(10, e)).toFixed(1);
    return m + '×10' + sup(e) + ' kg';
  }
  function validName(n) { return /^[0-9A-Za-z_\u4e00-\u9fff]{1,12}$/.test(n); }
  function wrapA(d) { d = (d + Math.PI) % (Math.PI * 2); if (d < 0) d += Math.PI * 2; return d - Math.PI; }
  function slotAngle(k, i) { return OFFS[k] + i * Math.PI * 2 / ORBITS[k]; }

  /* ---------- 棋盘与规则（纯函数，board 为 4×N 二维数组） ---------- */
  function newBoard() { return ORBITS.map(n => Array(n).fill(null)); }
  function put(board, k, i, body) { board[k][i] = body; return body; }
  function neighborSlots(k, i) {
    const out = [], n = ORBITS[k];
    out.push([k, (i + 1) % n], [k, (i - 1 + n) % n]);
    const a = slotAngle(k, i);
    [k - 1, k + 1].forEach(kk => {
      if (kk < 0 || kk > 3) return;
      let best = 0, bd = 1e9;
      for (let j = 0; j < ORBITS[kk]; j++) {
        const d = Math.abs(wrapA(a - slotAngle(kk, j)));
        if (d < bd) { bd = d; best = j; }
      }
      out.push([kk, best]);
    });
    return out;
  }
  function isFrozenSlot(board, k, i) {   // FR-204：空槽左右相邻存在冰卫星即冻结（派生，离场自动解冻）
    if (board[k][i]) return false;
    const n = ORBITS[k];
    for (const d of [1, -1]) { const b = board[k][(i + d + n) % n]; if (b && b.v === 'ice') return true; }
    return false;
  }
  function findPair(board) {
    for (let k = 0; k < 4; k++) for (let i = 0; i < ORBITS[k]; i++) {
      const a = board[k][i]; if (!a || a.t >= 14) continue;
      const b = board[k][(i + 1) % ORBITS[k]];
      if (b && b.t === a.t) return [k, i, (i + 1) % ORBITS[k]];
    }
    return null;
  }
  function migraTarget(board, k, i) {    // 产物外迁：外轨角距最近空槽，否则顺时针最近空槽
    if (k >= 3) return null;
    const a = slotAngle(k, i), n2 = ORBITS[k + 1];
    let best = 0, bd = 1e9;
    for (let j = 0; j < n2; j++) {
      const d = Math.abs(wrapA(a - slotAngle(k + 1, j)));
      if (d < bd) { bd = d; best = j; }
    }
    if (!board[k + 1][best]) return [k + 1, best];
    for (let s = 1; s <= n2; s++) { const jj = (best + s) % n2; if (!board[k + 1][jj]) return [k + 1, jj]; }
    return null;
  }
  function pathClear(board, k, i0, i1) {
    const n = ORBITS[k];
    if (i0 === i1) return false;
    for (const dir of [1, -1]) {
      let ok = true, j = (i0 + dir + n) % n, steps = 0;
      while (j !== i1 && steps < n) {
        if (board[k][j]) { ok = false; break; }
        j = (j + dir + n) % n; steps++;
      }
      if (ok) return true;
    }
    return false;
  }
  /* 自动合成结算：返回合并事件列表（含黑洞吞噬明细），经 hooks 回调外壳做动画/音效/图鉴 */
  function resolveBoard(board, hooks) {
    const H = hooks || {}, merges = [];
    let guard = 0, pr;
    while ((pr = findPair(board)) && guard++ < 300) {
      const [k, i, j] = pr;
      const t = board[k][i].t;
      const tgt = migraTarget(board, k, i) || [k, i];
      board[k][i] = null; board[k][j] = null;
      const prod = { t: t + 1, born: 0 };
      board[tgt[0]][tgt[1]] = prod;
      let devoured = null;
      if (t + 1 === 14) {
        devoured = [];
        neighborSlots(tgt[0], tgt[1]).forEach(([kk, jj]) => {
          const b = board[kk][jj];
          if (b) { devoured.push({ k: kk, i: jj, t: b.t }); board[kk][jj] = null; }
        });
      }
      const m = { from: [[k, i], [k, j]], to: tgt, tier: t, product: t + 1, prod, devoured };
      merges.push(m);
      if (H.onMerge) H.onMerge(m);
    }
    return merges;
  }

  /* ---------- 订单 / 评级 / 崩溃 ---------- */
  function deliverableIndex(order, t) {
    return order.findIndex(o => o.tier === t && o.delivered < o.count);
  }
  function canDeliver(order, t) { return deliverableIndex(order, t) >= 0; }
  function crashCondition(board, order, discard) {   // FR-107：无可用槽位（占用或冻结）且无可交付且弃置耗尽
    for (let k = 0; k < 4; k++) for (let i = 0; i < ORBITS[k]; i++) {
      if (!board[k][i] && !isFrozenSlot(board, k, i)) return false;
      if (board[k][i] && canDeliver(order, board[k][i].t)) return false;
    }
    return discard === 0;
  }
  function starCount(drops, loss, level) {           // FR-305：时间不参与
    let s = 1;
    if (drops <= level.maxDrops) s++;
    if (loss <= level.maxLossKg) s++;
    return s;
  }
  function orderDone(order) { return order.every(o => o.delivered >= o.count); }

  /* ---------- 候选池（rng 可注入，NFR-M03） ---------- */
  function pickTier(level, rng) {
    const rnd = rng || Math.random;
    const min = level.pool[0], max = level.pool[1], w = level.weights || [];
    const ws = []; let tot = 0;
    for (let t = min; t <= max; t++) { const v = w[t - min] || (max - t + 1); ws.push(v); tot += v; }
    let r = rnd() * tot;
    for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) return min + i; }
    return min;
  }
  function maybeVariant(level, t, rng) {
    const rnd = rng || Math.random, vs = level.variants || [];
    if (vs.includes('ice') && t === 4 && rnd() < 0.4) return { t: 4, v: 'ice' };
    if (vs.includes('pulse') && t === 13 && rnd() < 0.5) return { t: 13, v: 'pulse' };
    return t;
  }
  function rollPool(level, rng) {
    const mk = () => maybeVariant(level, pickTier(level, rng), rng);
    return [mk(), mk(), mk()];
  }
  function dexIdOf(b) { return b.v ? 'v-' + b.v : 't' + b.t; }

  /* ---------- 5.5 阈值推导（供关卡设计与测试自检） ---------- */
  function dMin(level) {
    let d = 0;
    level.order.forEach(o => {
      const inPool = o.tier >= level.pool[0] && o.tier <= level.pool[1];
      d += (inPool ? 1 : Math.pow(2, o.tier - level.pool[1])) * o.count;
    });
    return d;
  }
  function derivedThresholds(level) {
    const sum = level.order.reduce((a, o) => a + mass(o.tier) * o.count, 0);
    return { maxDrops: Math.ceil(1.5 * dMin(level)), maxLossKg: 0.2 * sum };
  }

  return {
    BODIES, DEX, LEVELS, ME, MS, ORBITS, OFFS,
    sup, mass, fmtMass, validName, slotAngle, wrapA,
    newBoard, put, neighborSlots, isFrozenSlot, findPair, migraTarget, pathClear,
    resolveBoard, deliverableIndex, canDeliver, crashCondition, starCount, orderDone,
    pickTier, maybeVariant, rollPool, dexIdOf, dMin, derivedThresholds,
  };
});
