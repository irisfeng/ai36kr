// 导出内容快照 → data/snapshot.json（随仓库部署，serverless 冷启动注水用）
// 用法：node scripts/export-snapshot.mjs
import path from 'node:path';
import fs from 'node:fs';
import db from '../lib/db.js';

const LIMITS = { posts: 600, flashes: 300, products: 100 };
const COLS = {
  posts: 'id, title, source, category, summary, content, is_deep, up, down, created_at, url, is_external, source_home, image_url',
  flashes: 'id, content, tag, up, created_at, url, source',
  products: 'id, name, tagline, description, category, up, created_at, url, image_url',
};

const snapshot = { exportedAt: new Date().toISOString(), version: 1 };
for (const [table, cols] of Object.entries(COLS)) {
  snapshot[table] = db
    .prepare(`SELECT ${cols} FROM ${table} ORDER BY created_at DESC LIMIT ${LIMITS[table]}`)
    .all();
}

const out = path.join(process.cwd(), 'data', 'snapshot.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(snapshot));
const kb = Math.round(fs.statSync(out).size / 1024);
console.log(
  `快照已导出：posts ${snapshot.posts.length} / flashes ${snapshot.flashes.length} / products ${snapshot.products.length}（${kb} KB）`
);
