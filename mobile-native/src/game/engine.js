/**
 * 星轨厨房 · RN 原生版游戏引擎（框架无关层）
 * 业务规则全部来自 src/core/starchef-core.js（平台无关核心模块，NFR-M03）。
 * 本文件不依赖 React Native，只产出状态与事件；UI 层（App.js/GameCanvas.js）订阅驱动。
 */
'use strict';
import C from '../core/starchef-core.js';

/* ---------- 布局（逻辑坐标系，竖屏） ---------- */
export const LAYOUT = {
  W: 900, H: 1600,
  CX: 450, CY: 780,
  RADII: [104, 158, 212, 266],
};
export function slotPos(k, i) {
  const a = C.slotAngle(k, i);
  return [LAYOUT.CX + LAYOUT.RADII[k] * Math.cos(a), LAYOUT.CY + LAYOUT.RADII[k] * Math.sin(a)];
}
export function bodyR(t) { return 11 + t * 2.9; }

/* ---------- 存档（AsyncStorage 由 UI 层注入实现） ---------- */
export function defaultSave() {
  return { unlocked: 1, stars: {}, best: {}, dex: [], playerName: '', leaderboard: [], tut: {},
    stats: { totalDeliveredKg: 0, maxTier: 0 }, settings: { muted: false } };
}
export function makeEngine(storage) {
  /* storage: { load(): Promise<save>, persist(save): Promise<void> } */
  const listeners = [];
  const on = fn => { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); };
  const emit = (type, data) => listeners.forEach(fn => fn(type, data));

  const eng = {
    SAVE: defaultSave(),
    S: null, MODE: 'menu',
    async init() {
      try { const s = await storage.load();
        if (s && typeof s.unlocked === 'number') this.SAVE = Object.assign(defaultSave(), s);
      } catch (e) {}
      return this.SAVE;
    },
    saveNow() { try { storage.persist(this.SAVE); } catch (e) {} },

    burst(x, y, color, n) {
      const S = this.S;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 160;
        S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          life: 0.4 + Math.random() * 0.5, at: S.time, color, r: 1.2 + Math.random() * 1.8 });
      }
    },
    /* ---------- 关卡 ---------- */
    startLevel(idx) {
      const lv = C.LEVELS[idx];
      this.S = {
        lvlIdx: idx, lvl: lv,
        board: C.newBoard(),
        pool: C.rollPool(lv), sel: 0,
        order: lv.order.map(o => ({ tier: o.tier, count: o.count, delivered: 0 })),
        score: 0, reso: 0, loss: 0, drops: 0, discard: 2, slide: 2,
        time: 0, driftAt: 6,
        nextMeteorAt: lv.meteor > 0 ? 14 : Infinity,
        warns: [], tool: null, slideSrc: null,
        merges: [], rings: [], floats: [], dels: [], parts: [], flashAt: -9, _resoTmp: 0,
      };
      this.MODE = 'play';
      emit('level', idx);
    },
    unlockDex(b) {
      const id = C.dexIdOf(b);
      if (this.SAVE.dex.includes(id)) return;
      this.SAVE.dex.push(id);
      this.SAVE.stats.maxTier = Math.max(this.SAVE.stats.maxTier || 0, b.t);
      this.saveNow();
      emit('dex', id);
    },
    resolveFx() {
      let ci = 0;
      return C.resolveBoard(this.S.board, {
        onMerge: m => {
          m.prod.born = this.S.time + .12;
          this.S._resoTmp += C.mass(m.product) * .1;
          this.unlockDex(m.prod);
          const [ax, ay] = slotPos(m.from[0][0], m.from[0][1]);
          const [bx, by] = slotPos(m.from[1][0], m.from[1][1]);
          const [px, py] = slotPos(m.to[0], m.to[1]);
          this.S.merges.push({ ax, ay, bx, by, px, py, at: this.S.time, t: m.tier });
          this.S.rings.push({ x: px, y: py, at: this.S.time, dur: .4, r1: 46, color: '#ffe9a8', lw: 3 });
          this.burst(px, py, '#ffe9a8', 8);
          emit('merge', m);
          if (m.devoured && m.devoured.length) {
            let lm = 0;
            m.devoured.forEach(d => { lm += C.mass(d.t); });
            this.S.loss += lm;
            this.S.rings.push({ x: px, y: py, at: this.S.time, dur: .9, r1: 130, color: '#b08cff', lw: 5 });
            this.burst(px, py, '#b08cff', 16);
            emit('blackhole', m.devoured.length);
          }
        }
      });
    },
    afterAction() {
      const cnt = this.resolveFx().length;
      if (cnt >= 2 && this.S._resoTmp > 0) {
        this.S.score += this.S._resoTmp; this.S.reso += this.S._resoTmp;
        this.S.floats.push({ x: LAYOUT.CX, y: LAYOUT.CY - 60, at: this.S.time, dur: 1.2,
          text: '共振 +' + C.fmtMass(this.S._resoTmp) });
        this.S._resoTmp = 0;
      } else if (cnt < 2) this.S._resoTmp = 0;
      this.checkEnd();
    },
    place(k, i) {
      const S = this.S;
      if (S.board[k][i]) return;
      if (C.isFrozenSlot(S.board, k, i)) { emit('toast', '该槽位被冰封'); return; }
      const it = S.pool[S.sel];
      const b = { t: (it && it.t !== undefined) ? it.t : it, born: S.time };
      if (it && it.v) b.v = it.v;
      C.put(S.board, k, i, b);
      S.drops++;
      this.unlockDex(b);
      S.pool = C.rollPool(S.lvl);
      emit('place');
      this.afterAction();
    },
    deliver(k, i) {
      const S = this.S, b = S.board[k][i];
      const oi = C.deliverableIndex(S.order, b.t);
      if (oi < 0) return false;
      const o = S.order[oi];
      o.delivered++;
      S.score += C.mass(b.t);
      this.SAVE.stats.totalDeliveredKg += C.mass(b.t);
      const [x, y] = slotPos(k, i);
      S.dels.push({ x0: x, y0: y, at: S.time, dur: .6 });
      S.floats.push({ x, y, at: S.time, dur: 1.1, text: '+' + C.fmtMass(C.mass(b.t)), color: '#9fe8ff' });
      S.board[k][i] = null;
      emit('deliver', o);
      this.saveNow();
      return true;
    },
    supernova(k, i) {
      const S = this.S;
      S.board[k][i] = null;
      C.neighborSlots(k, i).forEach(([kk, jj]) => {
        const b = S.board[kk][jj]; if (!b) return;
        if (b.t === 0) { S.board[kk][jj] = null; return; }
        S.loss += C.mass(b.t) - C.mass(b.t - 1);
        b.t--; b.born = S.time; this.unlockDex(b);
      });
      const [x, y] = slotPos(k, i);
      S.rings.push({ x, y, at: S.time, dur: .8, r1: 160, color: '#ffd76a', lw: 6 });
      S.flashAt = S.time;
      this.burst(x, y, '#ffcf7a', 18);
      emit('supernova');
      this.afterAction();
    },
    detonatePulse(k, i) {
      const S = this.S;
      S.board[k][i] = null;
      let n = 0;
      for (let j = 0; j < C.ORBITS[k]; j++) {
        const b = S.board[k][j];
        if (b && b.t <= 2) { S.loss += C.mass(b.t); S.board[k][j] = null; n++; }
      }
      const [x, y] = slotPos(k, i);
      S.rings.push({ x, y, at: S.time, dur: .7, r1: LAYOUT.RADII[k] * .6, color: '#bfe3ff', lw: 5 });
      S.flashAt = S.time;
      this.burst(x, y, '#bfe3ff', 16);
      emit('pulse', n);
      this.afterAction();
    },
    hitSlot(x, y) {
      const S = this.S;
      let best = null, bd = 1e9;
      for (let k = 0; k < 4; k++) for (let i = 0; i < C.ORBITS[k]; i++) {
        const [sx, sy] = slotPos(k, i);
        const b = S.board[k][i];
        const d = Math.hypot(x - sx, y - sy);
        const th = Math.max(34, (b ? bodyR(b.t) : 10) + 16);
        if (d < th && d < bd) { bd = d; best = [k, i]; }
      }
      return best;
    },
    tapBoard(x, y) {
      if (this.MODE !== 'play' || !this.S) return;
      const hit = this.hitSlot(x, y);
      if (!hit) { if (this.S.tool) { this.S.tool = null; this.S.slideSrc = null; } return; }
      const [k, i] = hit, b = this.S.board[k][i];
      if (this.S.tool === 'discard' && b) {
        this.S.loss += C.mass(b.t); this.S.board[k][i] = null; this.S.discard--; this.S.tool = null;
        emit('toast', '已弃置 ' + C.BODIES[b.t].name); return;
      }
      if (this.S.tool === 'slide') {
        if (b) { if (b.t === 14) { emit('toast', '黑洞无法被移动'); return; }
          this.S.slideSrc = [k, i]; emit('toast', '再点同一轨道的空槽'); return; }
        if (this.S.slideSrc) {
          const [sk, si] = this.S.slideSrc;
          if (sk !== k) { emit('toast', '只能沿同一轨道移动'); return; }
          if (C.isFrozenSlot(this.S.board, k, i)) { emit('toast', '目标槽位被冰封'); return; }
          if (C.pathClear(this.S.board, sk, si, i)) {
            this.S.board[k][i] = this.S.board[sk][si]; this.S.board[sk][si] = null;
            this.S.slide--; this.S.tool = null; this.S.slideSrc = null;
            this.afterAction(); return;
          }
          emit('toast', '路径被阻挡'); return;
        }
        emit('toast', '先选择要移动的天体'); return;
      }
      if (!b) { this.place(k, i); return; }
      if (this.deliver(k, i)) { this.checkEnd(); return; }
      if (b.t === 13) { if (b.v === 'pulse') this.detonatePulse(k, i); else this.supernova(k, i); return; }
      if (b.t === 14) { emit('toast', '黑洞只能作为终章订单目标交付'); return; }
      emit('toast', '当前订单不需要 ' + C.BODIES[b.t].name);
    },
    checkEnd() {
      const S = this.S;
      if (C.orderDone(S.order)) {
        this.MODE = 'winning'; S.wonAt = S.time + .6;
        const stars = C.starCount(S.drops, S.loss, S.lvl);
        this.SAVE.stars[S.lvlIdx] = Math.max(this.SAVE.stars[S.lvlIdx] || 0, stars);
        this.SAVE.best[S.lvlIdx] = Math.max(this.SAVE.best[S.lvlIdx] || 0, S.score);
        this.SAVE.unlocked = Math.max(this.SAVE.unlocked, Math.min(C.LEVELS.length, S.lvlIdx + 2));
        this.saveNow();
        return;
      }
      if (C.crashCondition(S.board, S.order, S.discard)) {
        this.MODE = 'crashing'; S.crashAt = S.time + .6;
      }
    },
    setLeaderboard(name) {
      if (!C.validName(name)) return false;
      this.SAVE.playerName = name;
      const tot = Object.values(this.SAVE.best).reduce((a, b) => a + b, 0);
      this.SAVE.leaderboard = this.SAVE.leaderboard.filter(e => e.name !== name);
      this.SAVE.leaderboard.push({ name, totalMassKg: tot, bestTier: this.SAVE.stats.maxTier || 0,
        updatedAt: new Date().toISOString() });
      this.SAVE.leaderboard.sort((a, b) => b.totalMassKg - a.totalMassKg);
      this.SAVE.leaderboard = this.SAVE.leaderboard.slice(0, 20);
      this.saveNow();
      return true;
    },
    /* ---------- 每帧（UI 层以 rAF 调用；返回 true 表示需要重绘） ---------- */
    tick(dt) {
      const S = this.S;
      this._dt = dt;
      if (!S) return false;
      if (this.MODE === 'play') {
        S.time += dt;
        if (S.time >= S.driftAt) {
          S.driftAt = S.time + 5;
          let moved = false;
          for (let k = 0; k < 4; k++) for (let i = 0; i < C.ORBITS[k]; i++) {
            const b = S.board[k][i];
            if (b && b.t === 1) { const j = (i + 1) % C.ORBITS[k];
              if (!S.board[k][j]) { S.board[k][j] = b; S.board[k][i] = null; moved = true; } }
          }
          if (moved && this.resolveFx().length) { S._resoTmp = 0; this.checkEnd(); }
        }
        if (S.time >= S.nextMeteorAt) {
          S.nextMeteorAt = S.time + S.lvl.meteor;
          const occ = [];
          for (let k = 0; k < 4; k++) for (let i = 0; i < C.ORBITS[k]; i++) if (S.board[k][i]) occ.push([k, i]);
          if (occ.length) {
            const [k, i] = occ[Math.floor(Math.random() * occ.length)];
            S.warns.push({ k, i, start: S.time, impact: S.time + 3 });
            emit('warn');
          }
        }
        for (let n = S.warns.length - 1; n >= 0; n--) {
          const w = S.warns[n];
          if (S.time >= w.impact) {
            S.warns.splice(n, 1);
            const b = S.board[w.k][w.i];
            if (b) {
              if (b.t === 0) S.board[w.k][w.i] = null;
              else { S.loss += C.mass(b.t) - C.mass(b.t - 1); b.t--; b.born = S.time; this.unlockDex(b); }
              const [x, y] = slotPos(w.k, w.i);
              S.rings.push({ x, y, at: S.time, dur: .5, r1: 60, color: '#ff8a5a', lw: 4 });
              this.burst(x, y, '#ff9f6a', 12);
              emit('meteor');
              if (this.resolveFx().length) S._resoTmp = 0;
            }
          }
        }
      } else if (this.MODE === 'winning' || this.MODE === 'crashing') {
        S.time += dt;
        if (this.MODE === 'winning' && S.time >= S.wonAt) { this.MODE = 'won'; emit('won'); }
        if (this.MODE === 'crashing' && S.time >= S.crashAt) { this.MODE = 'crash'; emit('crash'); }
      } else return false;
      // 粒子运动
      const pdt = this._dt || 0.016;
      S.parts = S.parts.filter(p => {
        p.x += p.vx * pdt; p.y += p.vy * pdt; p.vx *= 0.99; p.vy *= 0.99;
        return S.time - p.at <= p.life;
      });
      // 清理过期特效
      const now = S.time;
      ['merges', 'rings', 'floats', 'dels'].forEach(key => {
        const dur = { merges: .5, rings: .9, floats: 1.2, dels: .65 }[key];
        S[key] = S[key].filter(e => now - e.at <= (e.dur || dur));
      });
      return true;
    },
    starCount() { return C.starCount(this.S.drops, this.S.loss, this.S.lvl); },
    on, emit,
  };
  return eng;
}
export { C };
