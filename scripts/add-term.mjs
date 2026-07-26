// 词表管理：node scripts/add-term.mjs <protect|fix> <词条|正则> [替换为] [--remote] [--list]
// 例：
//   node scripts/add-term.mjs protect Gemini
//   node scripts/add-term.mjs fix '开放重量(级)?' '开放权重'
// 写入即持久化，下一轮聚合自动生效（译前保护/存量校正）
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('libsql');

const remote = process.argv.includes('--remote');
const list = process.argv.includes('--list');
const args = process.argv.filter((a) => !a.startsWith('--')).slice(2);
const [kind, fromText, toText] = args;

const db = remote
  ? new Database(process.env.TURSO_DATABASE_URL, { authToken: process.env.TURSO_AUTH_TOKEN })
  : new Database('data/tidewire.db');

if (list) {
  for (const r of db.prepare('SELECT kind, from_text, to_text FROM glossary ORDER BY kind, id').all())
    console.log(`${r.kind.padEnd(8)} ${r.from_text}${r.kind === 'fix' ? ' → ' + r.to_text : ''}`);
  process.exit(0);
}

if (!['protect', 'fix'].includes(kind) || !fromText || (kind === 'fix' && !toText)) {
  console.error('用法: node scripts/add-term.mjs <protect|fix> <词条|正则> [替换为] [--remote] [--list]');
  process.exit(1);
}
const r = db
  .prepare('INSERT OR IGNORE INTO glossary (kind, from_text, to_text, created_at) VALUES (?, ?, ?, ?)')
  .run(kind, fromText, kind === 'protect' ? fromText : toText, new Date().toISOString());
console.log(r.changes ? `已添加 ${kind}: ${fromText}${kind === 'fix' ? ' → ' + toText : ''}` : '已存在，跳过');
