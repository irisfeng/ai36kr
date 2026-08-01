// 全量备份：所有表导出为单个 JSONL 文件（每行一条 {table, row}）
// 用法：node scripts/backup-db.mjs [输出目录，默认 backup/]
// 由 daily-digest.yml 每日执行并提交到 snapshot 分支（保留最近 14 份）
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import db from '../lib/db.js';

const TABLES = [
  'posts', 'comments', 'votes', 'reactions', 'flashes', 'products',
  'subscribers', 'glossary', 'source_status', 'digest_log',
];

const outDir = process.argv[2] || 'backup';
fs.mkdirSync(outDir, { recursive: true });

const date = new Date().toISOString().slice(0, 10);
const outFile = path.join(outDir, `tidewire-${date}.jsonl.gz`);
const out = zlib.createGzip({ level: 6 });
const stream = fs.createWriteStream(outFile);
out.pipe(stream);

let total = 0;
for (const table of TABLES) {
  try {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    for (const row of rows) {
      out.write(JSON.stringify({ table, row }) + '\n');
      total++;
    }
  } catch (e) {
    console.warn(`跳过表 ${table}: ${e?.message || e}`);
  }
}
out.end();
await new Promise((res) => stream.on('finish', res));

const kb = Math.round(fs.statSync(outFile).size / 1024);
console.log(`备份完成：${total} 行 / ${TABLES.length} 张表 → ${outFile}（${kb} KB）`);

// 保留最近 14 份
const files = fs.readdirSync(outDir)
  .filter((f) => /^tidewire-\d{4}-\d{2}-\d{2}\.jsonl\.gz$/.test(f))
  .sort();
for (const old of files.slice(0, Math.max(0, files.length - 14))) {
  fs.rmSync(path.join(outDir, old));
  console.log(`清理旧备份：${old}`);
}
