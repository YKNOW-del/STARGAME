
import { newEngine, ok, eq } from './_helpers.js';
export const name = 'TC-10 榜单防刷';
export async function run() {
  const eng = await newEngine();
  eng.startLevel(0);
  eng.S.score = 100; eng.SAVE.best[0] = 100;
  ok(eng.setLeaderboard('玩家'), '合法名应成功');
  eq(eng.SAVE.leaderboard[0].totalMassKg, 100, '总质量=各关最佳和');
  eng.SAVE.best[0] = 160;                    // 重打得更高 → 差额
  eng.setLeaderboard('玩家');
  eq(eng.SAVE.leaderboard[0].totalMassKg, 160, '仅增加差额而非累加');
  eq(eng.SAVE.leaderboard.length, 1, '同名去重');
  ok(!eng.setLeaderboard('ab@cd'), '非法名应被拒');
  return {};
}
