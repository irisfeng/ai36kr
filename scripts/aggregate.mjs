// CI 聚合入口：GitHub Actions 定时执行 —— 抓取全部源 → 导出快照 → 由 workflow 提交
// 用法：node scripts/aggregate.mjs
import { spawnSync } from 'node:child_process';
import { refresh } from '../lib/rss.js';

const result = await refresh();
console.log('聚合结果:', JSON.stringify(result || {}));

// 聚合（含缩略图回填）完成后导出快照
const r = spawnSync(process.execPath, ['scripts/export-snapshot.mjs'], { stdio: 'inherit' });
process.exit(r.status ?? 0);
