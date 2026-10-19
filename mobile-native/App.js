/**
 * 星轨厨房 · RN 原生版界面层（菜单 / 对局 / 弹窗）
 * 依赖 @react-native-async-storage/async-storage 做持久化。
 */
'use strict';
import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeEngine, C } from './game/engine.js';
import GameCanvas from './game/GameCanvas.js';

const SAVE_KEY = 'starchef_native_v1';
const storage = {
  async load() { try { const s = await AsyncStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
  async persist(s) { try { await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) {} },
};

export default function App() {
  const engRef = useRef(null);
  if (!engRef.current) engRef.current = makeEngine(storage);
  const eng = engRef.current;
  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const [panel, setPanel] = useState(null); // 'dex' | 'board' | 'pause' | null
  const [name, setName] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => {
    eng.init().then(s => { setName(s.playerName || ''); setReady(true); });
    const off = eng.on((type, data) => {
      if (type === 'toast') showToast(data);
      if (type === 'blackhole') showToast('黑洞诞生！吞噬 ' + data + ' 个邻近天体');
      if (type === 'won' || type === 'crash') setFrame(f => f + 1);
    });
    return off;
  }, []);

  useEffect(() => {
    let raf, last = performance.now(), alive = true;
    const loop = now => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (eng.MODE === 'play' || eng.MODE === 'winning' || eng.MODE === 'crashing') {
        eng.tick(dt);
        setFrame(f => f + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, []);

  function showToast(msg) {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 1800);
  }

  if (!ready) return <SafeAreaView style={st.center}><Text style={st.gold}>星轨厨房 加载中…</Text></SafeAreaView>;
  if (eng.MODE === 'menu' && !panel) return <Menu eng={eng} onPlay={() => { setPanel(null); setFrame(f => f + 1); }}
    onDex={() => setPanel('dex')} onBoard={() => setPanel('board')} />;
  if (panel === 'dex') return <DexPanel eng={eng} onClose={() => setPanel(null)} />;
  if (panel === 'board') return <BoardPanel eng={eng} onClose={() => setPanel(null)} />;

  const S = eng.S;
  const won = eng.MODE === 'won', crashed = eng.MODE === 'crash';
  const paused = panel === 'pause';

  return (
    <SafeAreaView style={st.flex}>
      {/* 顶栏 */}
      <View style={st.topbar}>
        <View style={{ flex: 1 }}>
          <Text style={st.lvl}>{'第' + (S.lvlIdx + 1) + '关 · ' + S.lvl.name}</Text>
          <Text style={st.stats}>质量 {C.fmtMass(S.score)} · 投 {S.drops}/{S.lvl.maxDrops} · 损失 {C.fmtMass(S.loss)}</Text>
        </View>
        <TouchableOpacity style={st.btn} onPress={() => setPanel('pause')}><Text style={st.btnT}>⏸</Text></TouchableOpacity>
      </View>

      {/* 订单星座条 */}
      <View style={st.orderStrip}>
        {S.order.map((o, i) => {
          const done = o.delivered >= o.count;
          return (
            <View key={i} style={st.orderItem}>
              <Text style={done ? st.starOn : st.starOff}>{done ? '★' : '☆'}</Text>
              <Text style={st.orderTxt}>{C.BODIES[o.tier].name + ' ' + o.delivered + '/' + o.count}</Text>
            </View>
          );
        })}
      </View>

      {/* 棋盘（Skia） */}
      <View style={{ flex: 1 }}>
        <GameCanvas eng={eng} frame={frame} />
        {toastMsg !== '' && (
          <View style={st.toastWrap}><Text style={st.toast}>{toastMsg}</Text></View>
        )}
      </View>

      {/* 工具 + 候选池 */}
      <View style={st.bottom}>
        <View style={st.toolsRow}>
          <TouchableOpacity style={st.btn} disabled={S.discard <= 0}
            onPress={() => { S.tool = S.tool === 'discard' ? null : 'discard'; setFrame(f => f + 1); }}>
            <Text style={st.btnT}>{'✕ 弃置 ×' + S.discard}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.btn} disabled={S.slide <= 0}
            onPress={() => { S.tool = S.tool === 'slide' ? null : 'slide'; setFrame(f => f + 1); }}>
            <Text style={st.btnT}>{'↔ 滑移 ×' + S.slide}</Text>
          </TouchableOpacity>
        </View>
        <View style={st.poolRow}>
          {S.pool.map((it, i) => {
            const t = (it && it.t !== undefined) ? it.t : it;
            const v = it && it.v;
            const b = C.BODIES[t];
            return (
              <TouchableOpacity key={i} style={[st.card, S.sel === i && st.cardSel,
                v === 'ice' && { borderColor: '#9fe8ff' }, v === 'pulse' && { borderColor: '#ffb37a' }]}
                onPress={() => { S.sel = i; setFrame(f => f + 1); }}>
                <View style={[st.dot, { backgroundColor: b.c2 }]} />
                <Text style={st.cardT}>{b.name + (v === 'ice' ? ' ❄' : v === 'pulse' ? ' ⚡' : '')}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 弹窗：胜利 / 崩溃 / 暂停 */}
      {(won || crashed || paused) && (
        <View style={st.overlay}>
          <View style={st.panel}>
            {won && (
              <>
                <Text style={st.gold}>{'★'.repeat(eng.starCount()) + '☆'.repeat(3 - eng.starCount())}</Text>
                <Text style={st.panelTxt}>总质量 {C.fmtMass(S.score)}</Text>
                <Text style={st.panelTxt}>{S.score / C.ME >= 0.01 ? '你的宇宙重 ' + (S.score / C.ME).toFixed(2) + ' 个地球' : ''}</Text>
                <TextInput style={st.input} value={name} maxLength={12} placeholder="署名（1-12位）"
                  placeholderTextColor="#5a6690" onChangeText={setName} />
                <Row buttons={[
                  { label: '下一关', primary: S.lvlIdx + 1 < C.LEVELS.length, fn: () => { eng.setLeaderboard(name.trim()); eng.startLevel(S.lvlIdx + 1); } },
                  { label: '再来一次', fn: () => { eng.setLeaderboard(name.trim()); eng.startLevel(S.lvlIdx); } },
                  { label: '菜单', fn: () => { eng.setLeaderboard(name.trim()); eng.MODE = 'menu'; setFrame(f => f + 1); } },
                ]} />
              </>
            )}
            {crashed && (
              <>
                <Text style={{ color: '#ff8a8a', fontSize: 20, marginBottom: 8 }}>引力崩溃</Text>
                <Text style={st.panelTxt}>轨道已满且无出路——免费重开</Text>
                <Row buttons={[
                  { label: '重新开始', primary: true, fn: () => eng.startLevel(S.lvlIdx) },
                  { label: '菜单', fn: () => { eng.MODE = 'menu'; setFrame(f => f + 1); } },
                ]} />
              </>
            )}
            {paused && (
              <>
                <Text style={st.gold}>已暂停</Text>
                <Row buttons={[
                  { label: '继续', primary: true, fn: () => setPanel(null) },
                  { label: '图鉴', fn: () => setPanel('dex') },
                  { label: '重开', fn: () => { setPanel(null); eng.startLevel(S.lvlIdx); } },
                  { label: '菜单', fn: () => { setPanel(null); eng.MODE = 'menu'; setFrame(f => f + 1); } },
                ]} />
              </>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function Row({ buttons }) {
  return (
    <View style={st.row}>
      {buttons.filter(b => b.fn).map((b, i) => (
        <TouchableOpacity key={i} style={[st.btn, b.primary && st.btnGold]} onPress={b.fn}>
          <Text style={[st.btnT, b.primary && { color: '#ffd76a' }]}>{b.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Menu({ eng, onPlay, onDex, onBoard }) {
  const S = eng.SAVE;
  return (
    <SafeAreaView style={[st.flex, st.center]}>
      <Text style={{ color: '#ffd76a', fontSize: 34, letterSpacing: 6, marginBottom: 6 }}>星轨厨房</Text>
      <Text style={{ color: '#8896c8', fontSize: 13, marginBottom: 18 }}>React Native + Skia 原生骨架 v0.1</Text>
      <View style={st.menuGrid}>
        {C.LEVELS.map((lv, i) => {
          const lock = i + 1 > S.unlocked, stars = S.stars[i] || 0;
          return (
            <TouchableOpacity key={i} style={[st.lvlBtn, lock && { opacity: 0.4 }]} disabled={lock}
              onPress={() => { eng.startLevel(i); onPlay(); }}>
              <Text style={{ color: '#8896c8', fontSize: 10 }}>第 {i + 1} 关</Text>
              <Text style={{ color: '#e8ecff', fontSize: 12, fontWeight: 'bold', marginVertical: 2 }}>{lv.name}</Text>
              <Text style={{ color: '#ffd76a', fontSize: 11 }}>{lock ? '🔒' : '★'.repeat(stars) + '☆'.repeat(3 - stars)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={st.row}>
        <TouchableOpacity style={st.btn} onPress={onDex}><Text style={st.btnT}>{'📖 ' + S.dex.length + '/' + C.DEX.length}</Text></TouchableOpacity>
        <TouchableOpacity style={st.btn} onPress={onBoard}><Text style={st.btnT}>🏆 排行榜</Text></TouchableOpacity>
      </View>
      <Text style={{ color: '#5a6690', fontSize: 11, marginTop: 16, paddingHorizontal: 30, textAlign: 'center' }}>
        点候选 → 点空槽投放 → 相邻同级自动合成 → 点金圈天体交付点亮星座
      </Text>
    </SafeAreaView>
  );
}

function DexPanel({ eng, onClose }) {
  return (
    <SafeAreaView style={[st.flex, st.center]}>
      <Text style={st.gold}>{'📖 宇宙图鉴 ' + eng.SAVE.dex.length + '/' + C.DEX.length}</Text>
      <FlatList
        style={{ width: '88%', marginTop: 12 }}
        data={C.DEX}
        keyExtractor={d => d.id}
        numColumns={4}
        renderItem={({ item }) => {
          const un = eng.SAVE.dex.includes(item.id);
          return (
            <View style={[st.dexCell, !un && { opacity: 0.45 }]}>
              <View style={[st.dot, { backgroundColor: un ? C.BODIES[item.t].c2 : '#2a3148' }]} />
              <Text style={{ color: '#cfd8ff', fontSize: 10, textAlign: 'center' }}>
                {un ? (item.name || C.BODIES[item.t].name) : '？？？'}
              </Text>
            </View>
          );
        }}
      />
      <TouchableOpacity style={[st.btn, st.btnGold]} onPress={onClose}><Text style={[st.btnT, { color: '#ffd76a' }]}>返回</Text></TouchableOpacity>
    </SafeAreaView>
  );
}

function BoardPanel({ eng, onClose }) {
  const rows = eng.SAVE.leaderboard.slice().sort((a, b) => b.totalMassKg - a.totalMassKg).slice(0, 10);
  return (
    <SafeAreaView style={[st.flex, st.center]}>
      <Text style={st.gold}>🏆 本地排行榜</Text>
      <View style={{ width: '88%', marginTop: 12 }}>
        {rows.length === 0 && <Text style={{ color: '#8896c8', textAlign: 'center' }}>暂无记录——通关署名后上榜</Text>}
        {rows.map((r, i) => (
          <View key={i} style={st.lbRow}>
            <Text style={st.lbCell}>{i + 1}</Text>
            <Text style={[st.lbCell, { flex: 1 }]}>{r.name}</Text>
            <Text style={st.lbCell}>{C.fmtMass(r.totalMassKg)}</Text>
            <Text style={st.lbCell}>{C.BODIES[r.bestTier || 0].name}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={[st.btn, st.btnGold]} onPress={onClose}><Text style={[st.btnT, { color: '#ffd76a' }]}>返回</Text></TouchableOpacity>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#04060d' },
  center: { alignItems: 'center', justifyContent: 'center' },
  gold: { color: '#ffd76a', fontSize: 20, marginBottom: 8 },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  lvl: { color: '#ffd76a', fontSize: 15, fontWeight: 'bold' },
  stats: { color: '#aab6e8', fontSize: 11 },
  orderStrip: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 6,
    backgroundColor: 'rgba(10,16,38,.6)' },
  orderItem: { alignItems: 'center', marginHorizontal: 12 },
  starOn: { color: '#ffd76a', fontSize: 20 },
  starOff: { color: 'rgba(120,135,190,.5)', fontSize: 20 },
  orderTxt: { color: '#aab6e8', fontSize: 10 },
  bottom: { backgroundColor: 'rgba(6,10,26,.9)', paddingTop: 6, paddingBottom: 10 },
  toolsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 6 },
  poolRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  btn: { backgroundColor: 'rgba(70,90,180,.25)', borderColor: 'rgba(130,150,255,.35)',
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  btnGold: { borderColor: 'rgba(255,215,106,.6)' },
  btnT: { color: '#dfe6ff', fontSize: 13 },
  card: { width: 104, height: 68, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(120,140,255,.25)',
    backgroundColor: 'rgba(10,16,38,.8)', alignItems: 'center', justifyContent: 'center', gap: 5 },
  cardSel: { borderColor: '#ffd76a' },
  cardT: { color: '#cfd8ff', fontSize: 12 },
  dot: { width: 26, height: 26, borderRadius: 13 },
  toastWrap: { position: 'absolute', bottom: 12, alignSelf: 'center', backgroundColor: 'rgba(10,16,38,.92)',
    borderColor: 'rgba(130,150,255,.35)', borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  toast: { color: '#ffe9a8', fontSize: 12.5 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,5,12,.75)',
    alignItems: 'center', justifyContent: 'center' },
  panel: { backgroundColor: 'rgba(10,16,38,.96)', borderColor: 'rgba(130,150,255,.3)', borderWidth: 1,
    borderRadius: 14, padding: 22, width: '82%', alignItems: 'center' },
  panelTxt: { color: '#aab6e8', fontSize: 13.5, marginBottom: 4 },
  input: { color: '#fff', borderColor: 'rgba(130,150,255,.4)', borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6, width: 180, marginTop: 8, marginBottom: 4, fontSize: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 420 },
  lvlBtn: { width: 108, padding: 9, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(130,150,255,.35)',
    backgroundColor: 'rgba(20,30,64,.6)', alignItems: 'center' },
  dexCell: { width: 78, padding: 7, margin: 3, borderRadius: 9, borderWidth: 1,
    borderColor: 'rgba(130,150,255,.25)', backgroundColor: 'rgba(20,30,64,.5)', alignItems: 'center', gap: 4 },
  lbRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(130,150,255,.2)' },
  lbCell: { color: '#dfe6ff', fontSize: 12.5, marginHorizontal: 6 },
});
