/**
 * 星轨厨房 · RN 原生版渲染层（@shopify/react-native-skia）
 * 关键结论（Skia 1.7.5 / RN 0.76 实测）：Canvas 绘制坐标处于 dp 空间（框架自动按密度放大），
 * Group transform 在该组合下不可靠 —— 因此所有坐标在 JS 里显式缩放（fit 映射），不依赖 Group 变换。
 */
'use strict';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Canvas, Circle, Group, Rect, RoundedRect } from '@shopify/react-native-skia';
import { C, LAYOUT, slotPos, bodyR } from './engine.js';

const BG_STARS = Array.from({ length: 110 }, () => ({
  x: Math.random() * LAYOUT.W, y: Math.random() * LAYOUT.H,
  r: 0.5 + Math.random() * 1.4, a: 0.2 + Math.random() * 0.5,
}));

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
      bodies.push({ x, y, r: bodyR(b.t) * born, t: b.t, v: b.v, gold: C.canDeliver(S.order, b.t) });
    }
  }

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
          <Rect x={ox} y={oy} width={LAYOUT.W * sc} height={LAYOUT.H * sc} color="#05070f" />
          <Circle cx={X(220)} cy={Y(380)} r={R(300)} color="rgba(90,60,180,0.16)" />
          <Circle cx={X(700)} cy={Y(1100)} r={R(300)} color="rgba(40,120,170,0.14)" />
          {BG_STARS.map((s, i) => (
            <Circle key={'s' + i} cx={X(s.x)} cy={Y(s.y)} r={Math.max(0.4, R(s.r))}
              color={'rgba(255,255,255,' + s.a + ')'} />
          ))}
          <Circle cx={X(LAYOUT.CX)} cy={Y(LAYOUT.CY)} r={R(54)} color="rgba(255,179,0,.25)" />
          <Circle cx={X(LAYOUT.CX)} cy={Y(LAYOUT.CY)} r={R(44)} color="#f5a300" />
          <Circle cx={X(LAYOUT.CX) - R(12)} cy={Y(LAYOUT.CY) - R(12)} r={R(26)} color="#fffde7" />
          {LAYOUT.RADII.map((Rr, k) => (
            <Circle key={'o' + k} cx={X(LAYOUT.CX)} cy={Y(LAYOUT.CY)} r={R(Rr)}
              color="rgba(160,180,255,.16)" style="stroke" strokeWidth={Math.max(0.8, R(1.4))} />
          ))}
          {LAYOUT.RADII.map((Rr, k) =>
            Array.from({ length: C.ORBITS[k] }, (_, i) => {
              const [x, y] = slotPos(k, i);
              const frozen = !board[k][i] && C.isFrozenSlot(board, k, i);
              if (frozen) {
                return <RoundedRect key={'f' + k + '_' + i}
                  x={X(x) - R(8)} y={Y(y) - R(8)} width={R(16)} height={R(16)} r={R(2)}
                  color="rgba(159,232,255,.4)" />;
              }
              if (board[k][i]) return null;
              return <Circle key={'d' + k + '_' + i} cx={X(x)} cy={Y(y)} r={R(3.4)}
                color="rgba(200,215,255,.3)" />;
            })
          ).flat()}
          {S.warns.map((w, i) => {
            const [x, y] = slotPos(w.k, w.i);
            const p = 0.5 + 0.5 * Math.sin(t * 9);
            return <Circle key={'w' + i} cx={X(x)} cy={Y(y)} r={R(16 + 6 * p)}
              color={'rgba(255,90,60,' + (0.35 + 0.5 * p).toFixed(2) + ')'} style="stroke"
              strokeWidth={Math.max(1.5, R(3))} />;
          })}
          {bodies.map((b, i) => <Group key={'b' + i}>
            <Circle cx={X(b.x)} cy={Y(b.y)} r={R(b.r)} color={C.BODIES[b.t].c2} />
            <Circle cx={X(b.x) - R(b.r) * 0.3} cy={Y(b.y) - R(b.r) * 0.3} r={R(b.r) * 0.55}
              opacity={0.75} color={C.BODIES[b.t].c1} />
            {b.t === 11 && <Circle cx={X(b.x)} cy={Y(b.y)} r={R(b.r) * 1.5}
              color="rgba(255,246,200,.5)" style="stroke" strokeWidth={Math.max(1.5, R(2.5))} />}
            {b.v === 'ice' && <Circle cx={X(b.x)} cy={Y(b.y)} r={R(b.r) * 1.2}
              color="rgba(210,242,255,.8)" style="stroke" strokeWidth={Math.max(1, R(2))} />}
            {b.t === 14 && <Circle cx={X(b.x)} cy={Y(b.y)} r={R(b.r) * 1.3}
              color="rgba(200,150,255,.7)" style="stroke" strokeWidth={Math.max(1.5, R(3))} />}
            {b.gold && <Circle cx={X(b.x)} cy={Y(b.y)} r={R(b.r) + R(6)}
              color="rgba(255,215,106,.75)" style="stroke" strokeWidth={Math.max(1.2, R(2.4))} />}
          </Group>)}
          {S.rings.map((r0, i) => {
            const p = (t - r0.at) / r0.dur;
            if (p < 0 || p > 1) return null;
            return <Circle key={'r' + i} cx={X(r0.x)} cy={Y(r0.y)} r={R(10 + r0.r1 * p)}
              color={r0.color} opacity={1 - p} style="stroke" strokeWidth={Math.max(1.2, R(r0.lw))} />;
          })}
          {t - S.flashAt < 0.3 && t >= S.flashAt && (
            <Rect x={ox} y={oy} width={LAYOUT.W * sc} height={LAYOUT.H * sc}
              color={'rgba(255,250,230,' + (0.4 * (1 - (t - S.flashAt) / 0.3)).toFixed(3) + ')'} />
          )}
        </>}
      </Canvas>
    </View>
  );
}
