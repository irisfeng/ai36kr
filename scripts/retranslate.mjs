// 全量重译（LLM 语境版）：node scripts/retranslate.mjs [--remote] [--limit N]
import { createRequire } from 'node:module';
import { translateBatch, needsTranslation } from '../lib/translate.js';

const require = createRequire(import.meta.url);
const Database = require('libsql');

const remote = process.argv.includes('--remote');
const limitIdx = process.argv.indexOf('--limit');
const limit = limitIdx > 0 ? Number(process.argv[limitIdx + 1]) : 500;

const db = remote
  ? new Database(process.env.TURSO_DATABASE_URL, { authToken: process.env.TURSO_AUTH_TOKEN })
  : new Database('data/tidewire.db');

const rows = db
  .prepare("SELECT id, title, title_zh FROM posts WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?")
  .all(new Date(Date.now() - 30 * 86400000).toISOString(), limit)
  .filter((r) => needsTranslation(r.title));

console.log(`待重译 ${rows.length} 条（${remote ? '远端 Turso' : '本地'}）`);
const upd = db.prepare('UPDATE posts SET title_zh = ? WHERE id = ?');
let done = 0, changed = 0;
for (let i = 0; i < rows.length; i += 15) {
  const batch = rows.slice(i, i + 15);
  const translated = await translateBatch(batch.map((r) => r.title));
  batch.forEach((r, j) => {
    const zh = translated[j];
    if (zh && zh !== r.title) {
      upd.run(zh, r.id);
      done++;
      if (zh !== r.title_zh) {
        changed++;
        if (changed <= 8) console.log(`  ${r.title.slice(0, 55)}\n  旧: ${r.title_zh || '(无)'}\n  新: ${zh}\n`);
      }
    }
  });
  console.log(`  进度 ${Math.min(i + 15, rows.length)}/${rows.length}`);
}
console.log(`完成：${done} 条已译，其中 ${changed} 条译文改善`);
