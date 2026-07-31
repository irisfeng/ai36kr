// 导出内容快照 → data/snapshot.json（随仓库部署，serverless 冷启动注水用）
// 用法：node scripts/export-snapshot.mjs
import path from 'node:path';
import fs from 'node:fs';
import db from '../lib/db.js';

const LIMITS = { posts: 600, flashes: 300, products: 100, source_status: 100 };
const COLS = {
  posts: 'id, title, title_norm, title_zh, summary_zh, ext_score, source, category, summary, content, is_deep, up, down, created_at, url, is_external, source_home, image_url',
  flashes: 'id, content, tag, up, created_at, url, source',
  products: 'id, name, tagline, description, category, up, created_at, url, image_url',
  // 源健康状态随快照走：CI 每轮水合后 fail_streak 跨轮累计，连续失败告警才能生效
  source_status: 'name, home, url, ok, last_fetch, item_count, error, fail_streak',
};

const snapshot = { exportedAt: new Date().toISOString(), version: 1 };
for (const [table, cols] of Object.entries(COLS)) {
  const order = table === 'source_status' ? 'name' : 'created_at DESC';
  snapshot[table] = db
    .prepare(`SELECT ${cols} FROM ${table} ORDER BY ${order} LIMIT ${LIMITS[table]}`)
    .all();
}

const out = path.join(process.cwd(), 'data', 'snapshot.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
// 内容哈希（剔除时间戳）：无实质变化时不覆写文件——workflow 的 diff 检查自然跳过
// 提交与 Vercel 部署，避免每轮一个 800KB+ 快照 blob 造成仓库膨胀
try {
  const prev = JSON.parse(fs.readFileSync(out, 'utf8'));
  const strip = ({ exportedAt, ...rest }) => rest;
  if (JSON.stringify(strip(prev)) === JSON.stringify(strip(snapshot))) {
    console.log(`快照内容无实质变化，保留原文件（posts ${snapshot.posts.length} / flashes ${snapshot.flashes.length} / products ${snapshot.products.length}）`);
    process.exit(0);
  }
} catch { /* 首次导出或文件损坏：正常写入 */ }
fs.writeFileSync(out, JSON.stringify(snapshot));
const kb = Math.round(fs.statSync(out).size / 1024);
console.log(
  `快照已导出：posts ${snapshot.posts.length} / flashes ${snapshot.flashes.length} / products ${snapshot.products.length}（${kb} KB）`
);
