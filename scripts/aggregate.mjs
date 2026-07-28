// CI 聚合入口：GitHub Actions 定时执行 —— 抓取全部源 → 导出快照 → 由 workflow 提交
// 用法：node scripts/aggregate.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import db from '../lib/db.js';
import { refresh } from '../lib/rss.js';

const result = await refresh();
console.log('聚合结果:', JSON.stringify(result || {}));

// 聚合（含缩略图回填）完成后导出快照
const r = spawnSync(process.execPath, ['scripts/export-snapshot.mjs'], { stdio: 'inherit' });

// Step Summary：聚合量 / 失败源 / 快照规模在 Actions 页面直接可见，无需下载日志
if (process.env.GITHUB_STEP_SUMMARY) {
  try {
    const failed = db
      .prepare('SELECT name, error FROM source_status WHERE ok = 0 ORDER BY name')
      .all();
    let snapStats = '导出失败';
    try {
      const snap = JSON.parse(fs.readFileSync('data/snapshot.json', 'utf8'));
      snapStats = `posts ${snap.posts?.length ?? 0} / flashes ${snap.flashes?.length ?? 0} / products ${snap.products?.length ?? 0}`;
    } catch { /* 导出失败时保持默认文案 */ }
    const lines = [
      '## 定时聚合',
      '',
      `- 新增入库：**${result?.totalNew ?? 0}** 条；源在线：**${result?.okCount ?? 0}**`,
      `- 快照：${snapStats}`,
      `- 失败源（${failed.length}）：${failed.length ? failed.map((s) => `${s.name}（${(s.error || '未知').slice(0, 60)}）`).join('、') : '无'}`,
    ];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  } catch (e) {
    console.warn('Step Summary 写入失败（忽略）:', e?.message || e);
  }
}

process.exit(r.status ?? 0);
