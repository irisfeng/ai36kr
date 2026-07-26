import path from 'node:path';
import fs from 'node:fs';
import Database from 'libsql';

// 双模数据库：
// - 设置 TURSO_DATABASE_URL + TURSO_AUTH_TOKEN → 远端 Turso（Vercel serverless 持久化）
// - 否则 → 本地 SQLite 文件（Vercel 上退化到 /tmp，冷启动会重建，仅供演示）
const isRemote = !!process.env.TURSO_DATABASE_URL;

let db;
if (isRemote) {
  db = new Database(process.env.TURSO_DATABASE_URL, {
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
} else {
  const dataDir = process.env.VERCEL
    ? path.join('/tmp', 'aikr-data')
    : path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  db = new Database(path.join(dataDir, 'ai36kr.db'));
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 10000;');
}

// 表已存在则跳过初始化（远端 serverless 冷启动不必每次跑 DDL）
const { hasPosts } = db
  .prepare("SELECT COUNT(*) AS hasPosts FROM sqlite_master WHERE type='table' AND name='posts'")
  .get();

if (!hasPosts) {
  db.exec(`
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '社区投稿',
  category TEXT NOT NULL DEFAULT '大模型',
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  is_deep INTEGER NOT NULL DEFAULT 0,
  up INTEGER NOT NULL DEFAULT 0,
  down INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  url TEXT,
  is_external INTEGER NOT NULL DEFAULT 0,
  source_home TEXT,
  image_url TEXT
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  parent_id INTEGER,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  up INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS flashes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '发布',
  up INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  url TEXT,
  source TEXT
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  up INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  url TEXT,
  image_url TEXT
);
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  value INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(token, target_type, target_id)
);
CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  emoji TEXT NOT NULL,
  token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(post_id, emoji, token)
);
CREATE TABLE IF NOT EXISTS source_status (
  name TEXT PRIMARY KEY,
  home TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  ok INTEGER NOT NULL DEFAULT 0,
  last_fetch TEXT,
  item_count INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_votes_target ON votes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions(post_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_url ON posts(url) WHERE url IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_flashes_url ON flashes(url) WHERE url IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_url ON products(url) WHERE url IS NOT NULL;
  `);
}

// ---- 轻量迁移：老库补列（SQLite 不支持 IF NOT EXISTS 加列，逐个试探）----
// 远端为降低冷启动延迟，仅在标记缺失时执行（本地每次都跑，成本忽略）
function addColumnIfMissing(table, ddl) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`); } catch { /* 已存在 */ }
}
const needsMigration = !isRemote || !db
  .prepare("SELECT COUNT(*) AS c FROM pragma_table_info('posts') WHERE name='image_url'")
  .get().c;
if (needsMigration) {
  addColumnIfMissing('posts', 'url TEXT');
  addColumnIfMissing('posts', 'is_external INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('posts', 'source_home TEXT');
  addColumnIfMissing('flashes', 'url TEXT');
  addColumnIfMissing('flashes', 'source TEXT');
  addColumnIfMissing('products', 'url TEXT');
  addColumnIfMissing('posts', 'image_url TEXT');
  addColumnIfMissing('products', 'image_url TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_url ON posts(url) WHERE url IS NOT NULL');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_flashes_url ON flashes(url) WHERE url IS NOT NULL');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_url ON products(url) WHERE url IS NOT NULL');
}

// 全站内容来自真实聚合源 + 社区产生，无任何内置种子数据

export default db;
