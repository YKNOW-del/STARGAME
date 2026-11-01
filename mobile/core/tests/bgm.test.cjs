// BGM 状态机逻辑测试：从 DEMO.html 提取 startBgm/updateBgm 源码，配 Mock AudioContext + 可推进时钟
// 运行：node bgm.test.cjs
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', '..', '..', '星轨厨房DEMO.html'), 'utf8');
function extractFn(name) {
  const m = html.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n}'));
  if (!m) throw new Error('MISS ' + name);
  return m[0];
}
const src = extractFn('startBgm') + '\n' + extractFn('updateBgm');

// ---- 可控时钟（遮蔽全局定时器，供提取源码调用） ----
let NOW = 0;
const timers = new Map(); let tid = 0;
function schedule(fn, ms, repeating) {
  const id = ++tid; timers.set(id, { fn, at: NOW + ms, ms, repeating, alive: true });
  return id;
}
function killTimer(id) { const t = timers.get(id); if (t) t.alive = false; }
function setTimeoutW(fn, ms) { return schedule(fn, ms, false); }
function setIntervalW(fn, ms) { return schedule(fn, ms, true); }
function advance(ms) {
  const end = NOW + ms;
  for (;;) {
    let next = null;
    for (const t of timers.values()) if (t.alive && t.at <= end && (!next || t.at < next.at)) next = t;
    if (!next) break;
    NOW = next.at;
    if (next.repeating) next.at += next.ms; else next.alive = false;
    next.fn();
  }
  NOW = end;
}
const setTimeout = setTimeoutW, setInterval = setIntervalW;
const clearTimeout = killTimer, clearInterval = killTimer;

// ---- Mock WebAudio ----
let oscCount = 0; const startedOscs = [];
function mkParam(v) { return { value: v, _evts: [], setValueAtTime(x, t) { this._evts.push(['set', x, t]); this.value = x; }, linearRampToValueAtTime(x, t) { this._evts.push(['ramp', x, t]); this.value = x; }, cancelScheduledValues() { this._evts = []; } }; }
const AC = {
  get currentTime() { return NOW / 1000; },
  createGain() { return { gain: mkParam(1), connect() {}, disconnect() {} }; },
  createBiquadFilter() { return { type: '', frequency: mkParam(0), Q: mkParam(0), connect() {} }; },
  createDelay() { return { delayTime: mkParam(0), connect() {} }; },
  createOscillator() {
    oscCount++;
    return { id: oscCount, type: '', frequency: mkParam(0), detune: mkParam(0),
      connect() {}, start() { startedOscs.push(this.id); }, stop() {} };
  },
};
const SAVE = { settings: { bgm: .7, muted: false } };

let BGM = null;
// 直接 eval（非严格模式）：函数声明进入当前作用域，BGM/AC/SAVE/定时器沿作用域链解析
eval(src);

// ---- 断言 ----
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  PASS ' + msg); } else { fail++; console.log('  FAIL ' + msg); } }

console.log('T1 基本启动');
startBgm();
ok(BGM && BGM.running === true, 'BGM 实例创建且 running');
ok(startedOscs.length === 3, '首和弦 3 个振荡器启动 (实际 ' + startedOscs.length + ')');
const freqs = BGM.oscs.map(o => +o.frequency.value.toFixed(1)).sort((a, b) => a - b);
ok(JSON.stringify(freqs) === JSON.stringify([220, 261.6, 329.6]), 'Am 和弦频率正确 ' + JSON.stringify(freqs));
ok(BGM.oscs.every(o => o.type === 'sine'), '全部正弦波（无刺耳三角/方波）');
const busRamp = BGM.bus.gain._evts.find(e => e[0] === 'ramp');
ok(busRamp && Math.abs(busRamp[1] - 0.028) < 1e-9, '总线音量 = 0.04×0.7 渐入');

console.log('T2 和弦推进 + 琶音');
advance(8200);
ok(startedOscs.length >= 6, '8 秒后第二和弦调度 (osc=' + startedOscs.length + ')');
const f2 = BGM.oscs.slice(-3).map(o => +o.frequency.value.toFixed(1)).sort((a, b) => a - b);
ok(JSON.stringify(f2) === JSON.stringify([174.6, 220, 261.6]), '第二和弦为 F ' + JSON.stringify(f2));
advance(4200);
const arpF = BGM.oscs[BGM.oscs.length - 1].frequency.value;
// 琶音 = 当前和弦某音×2；随机延迟决定落在哪个和弦/第几音，用全体加倍音集合判定
const ALL_TONES = [220.0, 261.6, 329.6, 174.6, 130.8, 196.0, 246.9];
const doubledSet = ALL_TONES.map(f => +(f * 2).toFixed(1));
ok(doubledSet.includes(+arpF.toFixed(1)), '琶音频率为和弦音×2 (' + arpF.toFixed(1) + ')');

console.log('T3 音量→0 停止');
const oldBus = BGM.bus;
SAVE.settings.bgm = 0; updateBgm();
ok(BGM.running === false, 'running=false 定时器全清');
advance(1300);
ok(BGM === null, '1.2s 后实例回收');

console.log('T4 快速拉回（僵尸窗口，回归修复点）');
SAVE.settings.bgm = .5;
startBgm();
const gen2Ids = BGM.oscs.map(o => o.id);
SAVE.settings.bgm = 0; updateBgm();          // 停止
SAVE.settings.bgm = .5; updateBgm();         // 立即拉回 —— 旧代码此处永久静音
ok(BGM !== null && BGM.running === true && BGM.bus !== oldBus, '清理旧实例并重启（非僵尸）');
ok(BGM.oscs.length >= 3 && !gen2Ids.includes(BGM.oscs[0].id), '新实例振荡器独立');
const g2 = BGM.oscs.slice(-3).map(o => +o.frequency.value.toFixed(1)).sort((a, b) => a - b);
ok(JSON.stringify(g2) === JSON.stringify([220, 261.6, 329.6]), '重启从 Am 开始 ' + JSON.stringify(g2));

console.log('T5 静音开关路径');
SAVE.settings.muted = true; updateBgm();
ok(BGM.running === false, 'muted 停止');
advance(1300); SAVE.settings.muted = false;
updateBgm();
ok(BGM && BGM.running, '解除静音恢复');

console.log('T6 长期运行清理');
advance(60000);
ok(BGM.oscs.length <= 45, '振荡器引用有界不泄漏 (实际 ' + BGM.oscs.length + ')');
const timersAlive = [...timers.values()].filter(t => t.alive).length;
ok(timersAlive <= 3, '活跃定时器受控 (实际 ' + timersAlive + ')');
SAVE.settings.bgm = 0; updateBgm();          // 收尾清理
advance(1300);
ok(BGM === null, '收尾停止');

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
