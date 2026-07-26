// 存量译文术语校正：node scripts/fix-translations.mjs [--remote]
import { createRequire } from 'node:module';
import { applyTermFixes } from '../lib/translate.js';

const require = createRequire(import.meta.url);
const Database = require('libsql');

const remote = process.argv.includes('--remote');
const db = remote
  ? new Database(process.env.TURSO_DATABASE_URL, { authToken: process.env.TURSO_AUTH_TOKEN })
  : new Database('data/tidewire.db');

const rows = db.prepare("SELECT id, title_zh FROM posts WHERE title_zh IS NOT NULL AND title_zh != ''").all();
const upd = db.prepare('UPDATE posts SET title_zh = ? WHERE id = ?');
let fixed = 0;
for (const r of rows) {
  const better = applyTermFixes(r.title_zh);
  if (better !== r.title_zh) {
    upd.run(better, r.id);
    console.log(`  ${r.title_zh}\n→ ${better}\n`);
    fixed++;
  }
}
console.log(`修正 ${fixed}/${rows.length} 条译文（${remote ? '远端 Turso' : '本地'}）`);
