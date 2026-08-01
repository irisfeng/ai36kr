// 备份恢复：从 backup-db.mjs 产出的 JSONL.GZ 恢复全量数据
// 用法：node scripts/restore-backup.mjs <备份文件> [--db <目标库文件，默认 data/tidewire-restore.db>]
// INSERT OR IGNORE 幂等：可重复执行，只补缺不覆盖
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('libsql');

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('用法: node scripts/restore-backup.mjs <备份文件.jsonl.gz> [--db <目标库>]');
  process.exit(1);
}
const dbIdx = process.argv.indexOf('--db');
const target = dbIdx > 0 ? process.argv[dbIdx + 1] : 'data/tidewire-restore.db';
fs.mkdirSync(path.dirname(target), { recursive: true });
const db = new Database(target);

// 已知表先按真实 DDL 建全（空表也要恢复结构，否则恢复后缺表）
const TABLE_DDL = {
  posts: `CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '社区投稿', category TEXT NOT NULL DEFAULT '大模型',
    summary TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
    is_deep INTEGER NOT NULL DEFAULT 0, up INTEGER NOT NULL DEFAULT 0,
    down INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
    url TEXT, is_external INTEGER NOT NULL DEFAULT 0, source_home TEXT,
    image_url TEXT, title_norm TEXT, title_zh TEXT, summary_zh TEXT,
    ext_score INTEGER NOT NULL DEFAULT 0, hot_score REAL NOT NULL DEFAULT 0)`,
  comments: `CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, parent_id INTEGER,
    nickname TEXT NOT NULL, content TEXT NOT NULL, up INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL)`,
  votes: `CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL, target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL, value INTEGER NOT NULL, created_at TEXT NOT NULL,
    UNIQUE(token, target_type, target_id))`,
  reactions: `CREATE TABLE IF NOT EXISTS reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, emoji TEXT NOT NULL,
    token TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(post_id, emoji, token))`,
  flashes: `CREATE TABLE IF NOT EXISTS flashes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL,
    tag TEXT NOT NULL DEFAULT '发布', up INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, url TEXT, source TEXT)`,
  products: `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    tagline TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '', up INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, url TEXT, image_url TEXT)`,
  subscribers: `CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE,
    token TEXT NOT NULL UNIQUE, confirmed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, confirmed_at TEXT)`,
  glossary: `CREATE TABLE IF NOT EXISTS glossary (
    id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL,
    from_text TEXT NOT NULL, to_text TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, UNIQUE(kind, from_text))`,
  source_status: `CREATE TABLE IF NOT EXISTS source_status (
    name TEXT PRIMARY KEY, home TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '',
    ok INTEGER NOT NULL DEFAULT 0, last_fetch TEXT, item_count INTEGER NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT '', fail_streak INTEGER NOT NULL DEFAULT 0)`,
  digest_log: `CREATE TABLE IF NOT EXISTS digest_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, email TEXT NOT NULL,
    status TEXT NOT NULL, error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
    UNIQUE(day, email))`,
};
const ensured = new Set(Object.keys(TABLE_DDL));
// 零行表也先建结构：备份里没有它们的行，不预建就会丢表
for (const ddl of Object.values(TABLE_DDL)) db.exec(ddl);
function ensureTable(table, row) {
  if (ensured.has(table)) return;
  if (TABLE_DDL[table]) {
    db.exec(TABLE_DDL[table]);
  } else {
    const cols = Object.keys(row)
      .map((k) => `"${k}" ${k === 'id' ? 'INTEGER PRIMARY KEY' : ''}`)
      .join(', ');
    db.exec(`CREATE TABLE IF NOT EXISTS ${table} (${cols})`);
  }
  ensured.add(table);
}

const rl = readline.createInterface({
  input: fs.createReadStream(file).pipe(zlib.createGunzip()),
  crlfDelay: Infinity,
});

let total = 0;
const errors = [];
for await (const line of rl) {
  if (!line.trim()) continue;
  try {
    const { table, row } = JSON.parse(line);
    ensureTable(table, row);
    const keys = Object.keys(row);
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO ${table} (${keys.map((k) => `"${k}"`).join(', ')})
       VALUES (${keys.map(() => '?').join(', ')})`
    );
    stmt.run(...keys.map((k) => row[k] ?? null));
    total++;
  } catch (e) {
    errors.push(e?.message || String(e));
  }
}
console.log(`恢复完成：${total} 行 → ${target}${errors.length ? `（${errors.length} 行失败：${errors[0]}）` : ''}`);
