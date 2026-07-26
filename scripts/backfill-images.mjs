// 一次性缩略图批量回填：node --experimental-sqlite scripts/backfill-images.mjs [数量]
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fetchOgImage } from '../lib/ogimage.js';

const limit = Number(process.argv[2] || 340);
const db = new DatabaseSync(path.join(process.cwd(), 'data', 'ai36kr.db'));
db.exec('PRAGMA busy_timeout = 10000;');

const rows = db
  .prepare("SELECT id, url FROM posts WHERE image_url IS NULL AND url IS NOT NULL ORDER BY created_at DESC LIMIT ?")
  .all(limit);
console.log(`待回填 ${rows.length} 条`);
const stmt = db.prepare('UPDATE posts SET image_url = ? WHERE id = ?');
let filled = 0;
for (let i = 0; i < rows.length; i += 4) {
  const batch = rows.slice(i, i + 4);
  const imgs = await Promise.all(batch.map((r) => fetchOgImage(r.url)));
  batch.forEach((r, j) => {
    stmt.run(imgs[j] || '', r.id);
    if (imgs[j]) filled++;
  });
  if ((i / 4) % 10 === 9) console.log(`  进度 ${Math.min(i + 4, rows.length)}/${rows.length}，已得图 ${filled}`);
}
console.log(`完成：${filled}/${rows.length} 条获得缩略图`);
db.close();
