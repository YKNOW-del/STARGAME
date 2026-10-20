/**
 * 星轨厨房 · RN 原生版渲染层（@shopify/react-native-skia）
 * 只用基础图元（Rect/Circle/RoundedRect/Group），逻辑坐标 900×1600 由 engine.LAYOUT 定义。
 */
'use strict';
import React, { useMemo, useState } from 'react';
import { PixelRatio, View } from 'react-native';
import { Canvas, Circle, Fill, Group, Rect, RoundedRect } from '@shopify/react-native-skia';
import { C, LAYOUT, slotPos, bodyR } from './engine.js';

const BG_STARS = Array.from({ length: 130 }, () => ({
  x: Math.random() * LAYOUT.W, y: Math.random() * LAYOUT.H,
  r: 0.5 + Math.random() * 1.4, a: 0.2 + Math.random() * 0.5,
}));

function bodyColor(t) { return C.BODIES[t].c2; }
function bodyHi(t) { return C.BODIES[t].c1; }

export default function GameCanvas({ eng, frame, onToast }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pr = PixelRatio.get();
  const fit = size.w ? (() => {
    const sc = Math.min(size.w / LAYOUT.W, size.h / LAYOUT.H);
    return { sc, ox: (size.w - LAYOUT.W * sc) / 2, oy: (size.h - LAYOUT.H * sc) / 2 };
  })() : { sc: 0, ox: 0, oy: 0 };

  const board = eng.S ? eng.S.board : null;
  const t = eng.S ? eng.S.time : 0;

  const bodies = [];
  if (board) {
    for (let k = 0; k < 4; k++) for (let i = 0; i < C.ORBITS[k]; i++) {
      const b = board[k][i];
      if (!b) continue;
      const [x, y] = slotPos(k, i);
      const born = Math.min(1, Math.max(0, (t - b.born) / 0.28));
      const r = bodyR(b.t) * born;
      if (r <= 1) continue;
      bodies.push({ x, y, r, t: b.t, v: b.v, gold: C.canDeliver(eng.S.order, b.t) });
    }
  }

  if (size.w && !GameCanvas._logged) { GameCanvas._logged = 1; console.log('[DBG] size', JSON.stringify(size), 'fit', fit.sc.toFixed(3)); }
  return (
    <View
      style={{ flex: 1 }}
      onLayout={e => setSize({ w: e.nativeEvent.layout.width * pr, h: e.nativeEvent.layout.height * pr })}
      onTouchStart={e => {
        console.log('[TCH]', JSON.stringify(e.nativeEvent.touches[0] || e.nativeEvent.changedTouches[0] || {}));
        if (!fit.sc || !eng.S) return;
        const { locationX, locationY } = e.nativeEvent.touches[0] || e.nativeEvent.changedTouches[0];
        if (locationX === undefined) return;
        eng.tapBoard((locationX * pr - fit.ox) / fit.sc, (locationY * pr - fit.oy) / fit.sc);
      }}
      onStartShouldSetResponder={() => true}
    >
      <Canvas style={{ flex: 1 }} mode="continuous">
        <Rect x={0} y={0} width={size.w || 10} height={size.h || 10} color="rgba(255,0,0,0.18)" />
        {fit.sc > 0 && <Group transform={[{ translateX: fit.ox }, { translateY: fit.oy }, { scale: fit.sc }]}>
        {/* 背景 */}
        <Rect x={0} y={0} width={LAYOUT.W} height={LAYOUT.H} color="#05070f" />
        <Circle cx={220} cy={380} r={300} color="rgba(90,60,180,0.16)" />
        <Circle cx={700} cy={1100} r={300} color="rgba(40,120,170,0.14)" />
        {BG_STARS.map((s, i) => (
          <Circle key={'s' + i} cx={s.x} cy={s.y} r={s.r} color={'rgba(255,255,255,' + s.a + ')'} />
        ))}

        {/* 中心恒星 */}
        <Circle cx={LAYOUT.CX} cy={LAYOUT.CY} r={54} color="rgba(255,179,0,.25)" />
        <Circle cx={LAYOUT.CX} cy={LAYOUT.CY} r={44} color="#f5a300" />
        <Circle cx={LAYOUT.CX - 12} cy={LAYOUT.CY - 12} r={26} color="#fffde7" />

        {/* 轨道与槽位 */}
        {LAYOUT.RADII.map((R, k) => (
          <Circle key={'o' + k} cx={LAYOUT.CX} cy={LAYOUT.CY} r={R}
            color="rgba(160,180,255,.14)" style="stroke" strokeWidth={1.4} />
        ))}
        {board && LAYOUT.RADII.flatMap((R, k) =>
          Array.from({ length: C.ORBITS[k] }, (_, i) => {
            const [x, y] = slotPos(k, i);
            const frozen = !board[k][i] && C.isFrozenSlot(board, k, i);
            return frozen ? (
              <Group key={'f' + k + '_' + i} transform={[{ translateX: x - 8 }, { translateY: y - 8 }, { rotate: Math.PI / 4 }]}>
                <RoundedRect x={0} y={0} width={16} height={16} r={2}
                  color="rgba(159,232,255,.35)" />
              </Group>
            ) : (
              <Circle key={'d' + k + '_' + i} cx={x} cy={y} r={board[k][i] ? 0.1 : 3.4}
                color="rgba(200,215,255,.25)" />
            );
          })
        )}

        {/* 陨石预警 */}
        {eng.S && eng.S.warns.map((w, i) => {
          const [x, y] = slotPos(w.k, w.i);
          const p = 0.5 + 0.5 * Math.sin(t * 9);
          return <Circle key={'w' + i} cx={x} cy={y} r={16 + 6 * p}
            color={'rgba(255,90,60,' + (0.35 + 0.5 * p).toFixed(2) + ')'} style="stroke" strokeWidth={3} />;
        })}

        {/* 天体：双层圆近似球体光照；金圈=可交付 */}
        {bodies.map((b, i) => (
          <Group key={'b' + i}>
            <Circle cx={b.x} cy={b.y} r={b.r} color={bodyColor(b.t)} />
            <Circle cx={b.x - b.r * 0.3} cy={b.y - b.r * 0.3} r={b.r * 0.55} opacity={0.75} color={bodyHi(b.t)} />
            {b.t === 11 && (
              <Circle cx={b.x} cy={b.y} r={b.r * 1.5} color="rgba(255,246,200,.5)"
                style="stroke" strokeWidth={2.5} />
            )}
            {b.v === 'ice' && (
              <Circle cx={b.x} cy={b.y} r={b.r * 1.2} color="rgba(210,242,255,.8)"
                style="stroke" strokeWidth={2} />
            )}
            {b.t === 14 && (
              <Circle cx={b.x} cy={b.y} r={b.r * 1.3} color="rgba(200,150,255,.7)"
                style="stroke" strokeWidth={3} />
            )}
            {b.gold && (
              <Circle cx={b.x} cy={b.y} r={b.r + 6} color="rgba(255,215,106,.75)"
                style="stroke" strokeWidth={2.4} />
            )}
          </Group>
        ))}

        {/* 冲击环特效 */}
        {eng.S && eng.S.rings.map((r0, i) => {
          const p = (t - r0.at) / r0.dur;
          if (p < 0 || p > 1) return null;
          return <Circle key={'r' + i} cx={r0.x} cy={r0.y} r={10 + r0.r1 * p}
            color={r0.color} opacity={1 - p} style="stroke" strokeWidth={r0.lw} />;
        })}

        {/* 白闪 */}
        {eng.S && t - eng.S.flashAt < 0.3 && t >= eng.S.flashAt && (
          <Rect x={0} y={0} width={LAYOUT.W} height={LAYOUT.H}
            color={'rgba(255,250,230,' + (0.4 * (1 - (t - eng.S.flashAt) / 0.3)).toFixed(3) + ')'} />
        )}
        </Group>}
      </Canvas>
    </View>
  );
}
