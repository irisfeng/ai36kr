import path from 'node:path';
import fs from 'node:fs';
import Database from 'libsql';
import { backfillLocalTitleNorms } from './local-migrations.js';
import { createResilientDatabase } from './resilient-db.js';

// 双模数据库：
// - 设置 TURSO_DATABASE_URL + TURSO_AUTH_TOKEN → 远端 Turso（Vercel serverless 持久化）
// - 否则 → 本地 SQLite 文件（Vercel 上退化到 /tmp，冷启动会重建，仅供演示）
// 构建阶段（含 Vercel build）一律用本地临时 scratch 库：内容页均 force-dynamic
// 在请求时渲染；构建期若有个别纯静态页被预渲染，拿到的也只是空 scratch 库，
// 不连远端、不水合（远端连接/水合会拖垮 page data collection）
const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
const isRemote = !!process.env.TURSO_DATABASE_URL && !isBuild;

let db;
if (isRemote) {
  const connectRemote = () => new Database(process.env.TURSO_DATABASE_URL, {
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  db = createResilientDatabase(connectRemote, {
    onReconnect: () => {
      console.warn('[db] Turso Hrana stream expired; reconnected and retried one read');
    },
  });
} else {
  const dataDir = process.env.VERCEL
    ? path.join('/tmp', 'aikr-data')
    : path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  db = new Database(path.join(dataDir, isBuild ? `build-scratch-${process.pid}.db` : 'tidewire.db'));
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
CREATE TABLE IF NOT EXISTS glossary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,           -- protect: 译前占位保留原文 / fix: 译后替换
  from_text TEXT NOT NULL,      -- fix 时为正则源码
  to_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(kind, from_text)
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
// subscribers / glossary 表对老库随时可建，独立于全新建库分支
db.exec(`CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  confirmed_at TEXT
)`);
// 日报发送记录：多时点调度下保证同一北京日只发一次（幂等）
db.exec(`CREATE TABLE IF NOT EXISTS digest_log (
  sent_date TEXT PRIMARY KEY,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
)`);
// glossary 表对老库随时可建，独立于全新建库分支
db.exec(`CREATE TABLE IF NOT EXISTS glossary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  from_text TEXT NOT NULL,
  to_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(kind, from_text)
)`);
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
  addColumnIfMissing('posts', 'title_norm TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_url ON posts(url) WHERE url IS NOT NULL');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_flashes_url ON flashes(url) WHERE url IS NOT NULL');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_url ON products(url) WHERE url IS NOT NULL');
}

// 跨源去重：标题归一化唯一索引（同一新闻多源报道只留先到的）
addColumnIfMissing('posts', 'title_norm TEXT');
// 源连续失败计数（健康告警用）
addColumnIfMissing('source_status', 'fail_streak INTEGER NOT NULL DEFAULT 0');
// 标题中文译文缓存（lib/translate.js 轮询补译）
addColumnIfMissing('posts', 'title_zh TEXT');
// 摘要中文译文缓存
addColumnIfMissing('posts', 'summary_zh TEXT');
// 外部热度信号（如 HN 分数），参与热度排序
addColumnIfMissing('posts', 'ext_score INTEGER NOT NULL DEFAULT 0');
if (!isRemote) {
  // 本地回填（行级操作远端太贵；远端存量无 norm 不参与去重，新条目入库即带 norm）
  const norm = (t) => String(t).toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '').slice(0, 190);
  backfillLocalTitleNorms(db, norm);
  // 存量 HN 条目从摘要回填外部热度分（「HN 热议 · N 分」）
  const hnRows = db
    .prepare("SELECT id, summary FROM posts WHERE source = 'Hacker News' AND ext_score = 0 AND summary LIKE 'HN 热议%'")
    .all();
  if (hnRows.length) {
    const upd = db.prepare('UPDATE posts SET ext_score = ? WHERE id = ?');
    for (const r of hnRows) {
      const m = r.summary.match(/HN 热议 · (\d+) 分/);
      if (m) upd.run(Number(m[1]), r.id);
    }
  }
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_title_norm ON posts(title_norm) WHERE title_norm IS NOT NULL AND title_norm != ''");

// 全站内容来自真实聚合源 + 社区产生，无任何内置种子数据

// ---- 快照水合：空库（serverless 冷启动）时从随仓库部署的 data/snapshot.json 注水 ----
// 快照由 GitHub Actions 定时聚合更新（.github/workflows/aggregate.yml），
// 保证任何新实例立即有内容；随后 refreshIfStale 会在后台补齐最新增量
function hydrateIfEmpty() {
  if (isBuild) return; // 构建期不需要内容，且多 worker 并发写同一文件会死锁
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM posts').get();
  if (c > 0) return;
  const snapPath = path.join(process.cwd(), 'data', 'snapshot.json');
  if (!fs.existsSync(snapPath)) return;
  let snap;
  try {
    snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
  } catch {
    return;
  }
  const TABLE_COLS = {
    posts: ['id', 'title', 'title_norm', 'title_zh', 'summary_zh', 'ext_score', 'source', 'category', 'summary', 'content', 'is_deep', 'up', 'down', 'created_at', 'url', 'is_external', 'source_home', 'image_url'],
    flashes: ['id', 'content', 'tag', 'up', 'created_at', 'url', 'source'],
    products: ['id', 'name', 'tagline', 'description', 'category', 'up', 'created_at', 'url', 'image_url'],
    source_status: ['name', 'home', 'url', 'ok', 'last_fetch', 'item_count', 'error', 'fail_streak'],
  };
  let n = 0;
  for (const table of Object.keys(TABLE_COLS)) {
    const rows = snap[table] || [];
    const cols = TABLE_COLS[table];
    // 批量多行插入：远端每语句仅一次往返，50 行/批。
    // 注意：libsql 远程（hrana）不绑定命名参数，必须用位置参数
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      const placeholders = chunk.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ');
      const args = chunk.flatMap((row) => cols.map((c) => row[c] ?? null));
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES ${placeholders}`
      );
      n += Number(stmt.run(...args).changes);
    }
  }
  // id 从快照带入后，需把自增序列推过最大值，避免后续插入撞主键
  for (const table of ['posts', 'flashes', 'products']) {
    db.exec(`UPDATE sqlite_sequence SET seq = (SELECT MAX(id) FROM ${table}) WHERE name = '${table}'`);
  }
  if (n > 0) console.log(`[听潮] 快照水合完成：注入 ${n} 条（快照时间 ${snap.exportedAt || '未知'}）`);
}

hydrateIfEmpty();

export default db;
