/**
 * 星轨厨房 · RN 渲染层 v2（视觉精修版）
 * 坐标系约定（实测结论）：Canvas 绘制坐标 = dp 空间；Group transform 不可用，
 * 全部经 X/Y/R 辅助函数显式映射（letterbox 居中）。
 * 视觉要素：线性渐变背景 / 径向渐变星云与天体球体光照 / 太阳辉光 / 闪烁星空 /
 * 土星环 / 黑洞吸积盘 / 彗尾 / 预警倒计时弧 / 合成残影 / 粒子 / 交付飞行 / 浮动文字。
 */
'use strict';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  Canvas, Circle, Rect, RoundedRect, Oval, Path, Text, Group,
  RadialGradient, LinearGradient, BlurMask, Skia, matchFont, vec,
} from '@shopify/react-native-skia';
import { C, LAYOUT, slotPos, bodyR } from './engine.js';

const FONT = matchFont({ fontFamily: 'sans-serif', fontSize: 15, fontWeight: 'bold' });

const BG_STARS = Array.from({ length: 150 }, () => ({
  x: Math.random() * LAYOUT.W, y: Math.random() * LAYOUT.H,
  r: 0.4 + Math.random() * 1.5, a: 0.15 + Math.random() * 0.45,
  tw: 0.5 + Math.random() * 2, ph: Math.random() * 6.28,
}));

function rgba(hex, a) { // '#rrggbb' → 'rgba(r,g,b,a)'
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function GameCanvas({ eng, frame }) {
  const [size, setSize] = useState({ w: 0, h: 0 });   // dp
  const fit = size.w ? (() => {
    const sc = Math.min(size.w / LAYOUT.W, size.h / LAYOUT.H);
    return { sc, ox: (size.w - LAYOUT.W * sc) / 2, oy: (size.h - LAYOUT.H * sc) / 2 };
  })() : { sc: 0, ox: 0, oy: 0 };
  const { sc, ox, oy } = fit;
  const X = v => ox + v * sc, Y = v => oy + v * sc, R = v => v * sc;

  const S = eng.S;
  const board = S ? S.board : null;
  const t = S ? S.time : 0;

  const bodies = [];
  if (board) {
    for (let k = 0; k < 4; k++) for (let i = 0; i < C.ORBITS[k]; i++) {
      const b = board[k][i];
      if (!b) continue;
      const [x, y] = slotPos(k, i);
      const born = Math.min(1, Math.max(0, (t - b.born) / 0.28));
      if (born <= 0) continue;
      bodies.push({ x, y, k, i, r: bodyR(b.t) * born, t: b.t, v: b.v, gold: C.canDeliver(S.order, b.t) });
    }
  }

  // 陨石倒计时弧 Path（按剩余比例）
  const warnPaths = useMemo(() => {
    if (!S) return [];
    return S.warns.map(w => {
      const [x, y] = slotPos(w.k, w.i);
      const rr = R(24);
      const p = Skia.Path.Make();
      const prog = Math.min(1, Math.max(0, (t - w.start) / 3));
      p.addArc(Skia.XYWHRect(X(x) - rr, Y(y) - rr, rr * 2, rr * 2), -90, 360 * (1 - prog));
      return { p, x, y };
    });
  }, [S && S.warns.length, t, sc, ox, oy]);

  const orbitPath = useMemo(() => { // 供细轨道装饰的虚线外圈
    const p = Skia.Path.Make();
    return p;
  }, []);

  return (
    <View
      style={{ flex: 1 }}
      onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      onStartShouldSetResponder={() => true}
      onTouchStart={e => {
        if (!sc || !eng.S) return;
        const tc = e.nativeEvent.touches[0] || e.nativeEvent.changedTouches[0];
        if (tc && tc.locationX !== undefined) eng.tapBoard((tc.locationX - ox) / sc, (tc.locationY - oy) / sc);
      }}
    >
      <Canvas style={{ flex: 1 }} mode="continuous">
        {sc > 0 && board && <>
          {/* ===== 背景：线性渐变 + 径向星云 + 闪烁星空 ===== */}
          <Rect x={ox} y={oy} width={LAYOUT.W * sc} height={LAYOUT.H * sc}>
            <LinearGradient start={vec(X(0), Y(0))} end={vec(X(0), Y(LAYOUT.H))}
              colors={['#0a1030', '#05070f', '#02030a']} />
          </Rect>
          <Circle cx={X(240)} cy={Y(400)} r={R(320)}>
            <RadialGradient c={vec(X(240), Y(400))} r={R(320)} colors={['rgba(120,70,200,0.20)', 'rgba(120,70,200,0)']} />
          </Circle>
          <Circle cx={X(690)} cy={Y(1150)} r={R(320)}>
            <RadialGradient c={vec(X(690), Y(1150))} r={R(320)} colors={['rgba(40,110,180,0.18)', 'rgba(40,110,180,0)']} />
          </Circle>
          <Circle cx={X(450)} cy={Y(780)} r={R(300)}>
            <RadialGradient c={vec(X(450), Y(780))} r={R(300)} colors={['rgba(150,80,140,0.10)', 'rgba(150,80,140,0)']} />
          </Circle>
          {BG_STARS.map((s, i) => {
            const a = Math.min(1, s.a * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph)) + 0.18);
            return <Circle key={'s' + i} cx={X(s.x)} cy={Y(s.y)} r={Math.max(0.35, R(s.r))}
              color={`rgba(255,255,255,${a.toFixed(2)})`} />;
          })}

          {/* ===== 中心恒星：双层辉光 + 渐变球体 ===== */}
          <Circle cx={X(LAYOUT.CX)} cy={Y(LAYOUT.CY)} r={R(78)}>
            <RadialGradient c={vec(X(LAYOUT.CX), Y(LAYOUT.CY))} r={R(78)}
              colors={['rgba(255,190,60,0.65)', 'rgba(255,150,30,0)']} />
          </Circle>
          <Circle cx={X(LAYOUT.CX)} cy={Y(LAYOUT.CY)} r={R(58)}>
            <RadialGradient c={vec(X(LAYOUT.CX), Y(LAYOUT.CY))} r={R(58)}
              colors={['rgba(255,215,106,0.8)', 'rgba(255,215,106,0)']} />
          </Circle>
          <Circle cx={X(LAYOUT.CX)} cy={Y(LAYOUT.CY)} r={R(44)}>
            <RadialGradient c={vec(X(LAYOUT.CX) - R(10), Y(LAYOUT.CY) - R(10))} r={R(46)}
              colors={['#fffde7', '#ffcf33', '#f5a300']} />
          </Circle>

          {/* ===== 轨道 ===== */}
          {LAYOUT.RADII.map((Rr, k) => (
            <Circle key={'o' + k} cx={X(LAYOUT.CX)} cy={Y(LAYOUT.CY)} r={R(Rr)}
              color="rgba(160,180,255,.15)" style="stroke" strokeWidth={Math.max(0.7, R(1.2))} />
          ))}

          {/* ===== 槽位 ===== */}
          {LAYOUT.RADII.map((Rr, k) =>
            Array.from({ length: C.ORBITS[k] }, (_, i) => {
              const [x, y] = slotPos(k, i);
              const frozen = !board[k][i] && C.isFrozenSlot(board, k, i);
              if (frozen) {
                return <Group key={'f' + k + '_' + i}>
                  <Circle cx={X(x)} cy={Y(y)} r={R(14)}>
                    <RadialGradient c={vec(X(x), Y(y))} r={R(14)} colors={['rgba(159,232,255,.35)', 'rgba(159,232,255,0)']} />
                  </Circle>
                  <RoundedRect x={X(x) - R(6)} y={Y(y) - R(6)} width={R(12)} height={R(12)} r={R(2)}
                    color="rgba(200,240,255,.55)" />
                </Group>;
              }
              if (board[k][i]) return null;
              return <Circle key={'d' + k + '_' + i} cx={X(x)} cy={Y(y)} r={R(3)}
                color="rgba(200,215,255,.30)" />;
            })
          ).flat()}

          {/* ===== 陨石预警：脉冲圈 + 倒计时弧 ===== */}
          {S.warns.map((w, i) => {
            const [x, y] = slotPos(w.k, w.i);
            const p = 0.5 + 0.5 * Math.sin(t * 9);
            return <Group key={'w' + i}>
              <Circle cx={X(x)} cy={Y(y)} r={R(15 + 7 * p)}
                color={`rgba(255,90,60,${(0.30 + 0.4 * p).toFixed(2)})`} style="stroke" strokeWidth={Math.max(1.4, R(2.6))} />
              {warnPaths[i] && <Path path={warnPaths[i].p} color="rgba(255,90,60,.9)"
                style="stroke" strokeWidth={Math.max(1.6, R(3))} strokeCap="round" />}
            </Group>;
          })}

          {/* ===== 天体（径向渐变球体 + 特征装饰） ===== */}
          {bodies.map((b, i) => {
            const cx = X(b.x), cy = Y(b.y), r = Math.max(0.5, R(b.r));
            const col = C.BODIES[b.t];
            const dir = Math.atan2(b.y - LAYOUT.CY, b.x - LAYOUT.CX);
            return <Group key={'b' + i}>
              {b.t === 13 && <Circle cx={cx} cy={cy} r={r * 1.6}>
                <RadialGradient c={vec(cx, cy)} r={r * 1.6} colors={['rgba(255,215,80,.4)', 'rgba(255,215,80,0)']} />
              </Circle>}
              {b.t === 14 && <Circle cx={cx} cy={cy} r={r * 1.7}>
                <RadialGradient c={vec(cx, cy)} r={r * 1.7} colors={['rgba(176,140,255,.35)', 'rgba(176,140,255,0)']} />
              </Circle>}
              {b.t === 1 && [0.5, 1.0, 1.5].map((d, j) => ( // 彗尾
                <Circle key={'tail' + j} cx={cx + Math.cos(dir) * r * d * 1.6} cy={cy + Math.sin(dir) * r * d * 1.6}
                  r={r * (0.55 - j * 0.13)} color={`rgba(160,230,255,${(0.30 - j * 0.08).toFixed(2)})`} />
              ))}
              <Circle cx={cx} cy={cy} r={r}>
                {b.t === 14
                  ? <RadialGradient c={vec(cx, cy)} r={r} colors={['#1c2333', '#05070d', '#000000']} />
                  : <RadialGradient c={vec(cx - r * 0.32, cy - r * 0.32)} r={r * 1.25}
                    colors={[col.c1, col.c2]} />}
              </Circle>
              {b.t !== 14 && <Circle cx={cx - r * 0.34} cy={cy - r * 0.34} r={r * 0.36}
                color={rgba(col.c1, 0.62)} />}
              {b.t === 11 && <Oval x={cx - r * 1.55} y={cy - r * 0.5} width={r * 3.1} height={r}
                color="rgba(255,246,200,.75)" style="stroke" strokeWidth={Math.max(1.2, R(2.4))} />}
              {b.t === 14 && <>
                <Oval x={cx - r * 1.4} y={cy - r * 0.55} width={r * 2.8} height={r * 1.1}
                  color="rgba(200,150,255,.85)" style="stroke" strokeWidth={Math.max(1.4, R(2.8))} />
                <Oval x={cx - r * 1.15} y={cy - r * 0.42} width={r * 2.3} height={r * 0.84}
                  color="rgba(255,180,90,.7)" style="stroke" strokeWidth={Math.max(1.2, R(2.2))} />
              </>}
              {b.v === 'ice' && <>
                <Circle cx={cx} cy={cy} r={r * 1.22} color="rgba(210,242,255,.85)"
                  style="stroke" strokeWidth={Math.max(1, R(1.8))} />
                {[0, 1, 2, 3, 4, 5].map(jn => {
                  const a = jn * Math.PI / 3 + 0.3;
                  return <Circle key={'sp' + jn} cx={cx + Math.cos(a) * r * 0.65} cy={cy + Math.sin(a) * r * 0.65}
                    r={Math.max(0.8, R(1.6))} color="rgba(220,246,255,.9)" />;
                })}
              </>}
              {b.gold && <Circle cx={cx} cy={cy} r={r + R(6)}
                color={`rgba(255,215,106,${(0.45 + 0.3 * Math.sin(t * 5)).toFixed(2)})`}
                style="stroke" strokeWidth={Math.max(1.4, R(2.2))} />}
            </Group>;
          })}

          {S.merges.map((m, i) => {
            const p = (t - m.at) / 0.42;
            if (p < 0 || p > 1) return null;
            const ea = 1 - p, rr = R(bodyR(m.t)) * ea;
            return <Group key={'m' + i}>
              {rr > 0.5 && <>
                <Circle cx={X(m.ax)} cy={Y(m.ay)} r={rr} color={rgba(C.BODIES[m.t].c2, ea * 0.8)} />
                <Circle cx={X(m.bx)} cy={Y(m.by)} r={rr} color={rgba(C.BODIES[m.t].c2, ea * 0.8)} />
              </>}
            </Group>;
          })}
          {S.rings.map((r0, i) => {
            const p = (t - r0.at) / r0.dur;
            if (p < 0 || p > 1) return null;
            return <Circle key={'r' + i} cx={X(r0.x)} cy={Y(r0.y)} r={R(10 + r0.r1 * p)}
              color={r0.color} opacity={1 - p} style="stroke" strokeWidth={Math.max(1.2, R(r0.lw))} />;
          })}

          {S.dels.map((d, i) => {
            const p = Math.min(1, (t - d.at) / 0.6);
            const x = d.x0 + (LAYOUT.CX - d.x0) * p;
            const y = d.y0 + (60 - d.y0) * p - Math.sin(p * Math.PI) * 60;
            return <Circle key={'dl' + i} cx={X(x)} cy={Y(y)} r={R(10) * (1 - p * 0.5)}
              color={`rgba(159,232,255,${(0.9 - p * 0.4).toFixed(2)})`} />;
          })}

          {S.parts.map((pt, i) => {
            const p = (t - pt.at) / pt.life;
            if (p < 0 || p > 1) return null;
            const col = pt.color.startsWith('#') ? rgba(pt.color, 1 - p) : pt.color;
            return <Circle key={'p' + i} cx={X(pt.x)} cy={Y(pt.y)} r={Math.max(0.6, R(pt.r))} color={col} opacity={1 - p} />;
          })}

          {S.floats.map((f, i) => {
            const p = (t - f.at) / f.dur;
            if (p < 0 || p > 1) return null;
            return <Text key={'ft' + i} x={X(f.x) - 40} y={Y(f.y) - 30 - 34 * p}
              text={f.text} font={FONT} color={f.color || '#ffe9a8'} opacity={1 - p * p} />;
          })}

          {t - S.flashAt < 0.3 && t >= S.flashAt && (
            <Rect x={ox} y={oy} width={LAYOUT.W * sc} height={LAYOUT.H * sc}
              color={`rgba(255,250,230,${(0.4 * (1 - (t - S.flashAt) / 0.3)).toFixed(3)})`} />
          )}
        </>}
      </Canvas>
    </View>
  );
}
