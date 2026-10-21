/** 测试运行器：node run-all.js（退出码非 0 = 有失败） */
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const files = readdirSync('.').filter(f => /^tc.*\.spec\.js$/.test(f)).sort();
let pass = 0, fail = 0, skip = 0;
for (const f of files) {
  const mod = await import(pathToFileURL(f).href);
  try {
    const r = await mod.run();
    if (r.status === 'skip') { skip++; console.log(`  - ${mod.name}: 跳过（${r.info}）`); }
    else { pass++; console.log(`  ✓ ${mod.name}: ${r.info || '通过'}`); }
  } catch (e) { fail++; console.error(`  ✗ ${mod.name}: ${e.message}`); }
}
console.log(`\n结果: ${pass} 通过, ${fail} 失败, ${skip} 跳过（共 ${files.length} 项）`);
process.exit(fail ? 1 : 0);
