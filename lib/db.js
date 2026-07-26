import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'ai36kr.db'));

// WAL + busy_timeout：Next 构建/运行会有多个进程同时打开数据库
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 10000;');

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
  created_at TEXT NOT NULL
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
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  up INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
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
`);

// ---- 轻量迁移：老库补列（SQLite 不支持 IF NOT EXISTS 加列，逐个试探）----
function addColumnIfMissing(table, ddl) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`); } catch { /* 已存在 */ }
}
addColumnIfMissing('posts', 'url TEXT');
addColumnIfMissing('posts', 'is_external INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('posts', 'source_home TEXT');
// 聚合条目按 url 去重（部分唯一索引；NULL 不受限，不影响旧数据与无链接投稿）
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_url ON posts(url) WHERE url IS NOT NULL');
// 快讯 / 新品同样按 url 去重（真实来源：Readhub、36氪快讯、Product Hunt）
addColumnIfMissing('flashes', 'url TEXT');
addColumnIfMissing('flashes', 'source TEXT');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_flashes_url ON flashes(url) WHERE url IS NOT NULL');
addColumnIfMissing('products', 'url TEXT');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_url ON products(url) WHERE url IS NOT NULL');
// 缩略图：优先取 RSS 内嵌图，缺失时由 og:image 回填（'' 表示已尝试无图，NULL 表示未尝试）
addColumnIfMissing('posts', 'image_url TEXT');
addColumnIfMissing('products', 'image_url TEXT');

// 全站内容来自真实聚合源 + 社区产生，无任何内置种子数据

export default db;
