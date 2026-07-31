import Link from 'next/link';
import { notFound } from 'next/navigation';
import db from '@/lib/db';
import { attachReactions } from '@/lib/queries';
import { hotWords, AI_KEYWORDS } from '@/lib/keywords';
import { timeAgo } from '@/lib/time';

export const revalidate = 60;

const SITE = 'https://aikr.shddai.net';

// 热词落地页（programmatic SEO）：/word/DeepSeek、/word/Claude …
// 每个 AI 热词一页：30 天热度走势 + 相关收录 + 共现热词，词与词互链成网

function cleanWord(raw) {
  const w = decodeURIComponent(raw || '').trim().slice(0, 30);
  return /^[\w一-鿿.+-]{1,30}$/i.test(w) ? w : '';
}

function wordStats(word) {
  const like = `%${word}%`;
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const rows = db.prepare(
    `SELECT created_at FROM posts WHERE (title LIKE ? OR summary LIKE ?) AND created_at >= ?`
  ).all(like, like, since30);
  // 按日聚合（近 14 天柱状图用）
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }
  const counts = Object.fromEntries(days.map((d) => [d, 0]));
  for (const r of rows) {
    const d = r.created_at.slice(0, 10);
    if (d in counts) counts[d]++;
  }
  const last7 = days.slice(7).reduce((a, d) => a + counts[d], 0);
  const prev7 = days.slice(0, 7).reduce((a, d) => a + counts[d], 0);
  return { total: rows.length, last7, prev7, daily: days.map((d) => ({ date: d, n: counts[d] })) };
}

export async function generateMetadata({ params }) {
  const word = cleanWord((await params).word);
  if (!word) return { title: '热词不存在' };
  const s = wordStats(word);
  return {
    title: `${word} - AI 热词`,
    description: `${word} 最近 30 天在 AI 圈被收录 ${s.total} 次：热度走势、相关新闻收录、共现热词。听潮 TideWire 聚合 37 个信息源自动生成。`,
    alternates: { canonical: `${SITE}/word/${encodeURIComponent(word)}` },
  };
}

export default async function WordPage({ params }) {
  const word = cleanWord((await params).word);
  if (!word) notFound();

  const stats = wordStats(word);
  const like = `%${word}%`;
  const rows = db.prepare(
    `SELECT p.id, p.title, p.title_zh, p.source, p.category, p.created_at, p.up, p.down,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
     FROM posts p
     WHERE (p.title LIKE ? OR p.summary LIKE ?) AND p.created_at >= ?
     ORDER BY p.created_at DESC LIMIT 20`
  ).all(like, like, new Date(Date.now() - 30 * 86400000).toISOString());
  const posts = attachReactions(rows);

  // 共现热词：在这些文章里还高频出现哪些词
  const coPosts = db.prepare(
    `SELECT title, summary FROM posts WHERE (title LIKE ? OR summary LIKE ?) AND created_at >= ? LIMIT 100`
  ).all(like, like, new Date(Date.now() - 30 * 86400000).toISOString());
  const coWords = hotWords(coPosts, 30)
    .filter((w) => w.word.toLowerCase() !== word.toLowerCase())
    .slice(0, 8);

  const trend = stats.prev7 === 0 ? (stats.last7 > 0 ? 'up' : 'flat')
    : stats.last7 > stats.prev7 * 1.2 ? 'up'
    : stats.last7 < stats.prev7 * 0.8 ? 'down' : 'flat';
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.n));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${word} - AI 热词相关收录`,
    itemListElement: posts.slice(0, 10).map((p, i) => ({
      '@type': 'ListItem', position: i + 1,
      url: `${SITE}/post/${p.id}`, name: p.title_zh || p.title,
    })),
  };

  return (
    <div className="container" style={{ maxWidth: 860 }}>
      <div className="page-head">
        <p className="word-crumb"><Link href="/weekly">本周热词榜</Link> / 热词</p>
        <h1 className="word-title">
          {word}
          <span className={`word-trend ${trend}`}>
            {trend === 'up' ? '▲ 升温' : trend === 'down' ? '▼ 降温' : '— 平稳'}
          </span>
        </h1>
        <p suppressHydrationWarning>
          近 30 天收录 {stats.total} 条 · 近 7 天 {stats.last7} 条（上周期 {stats.prev7} 条）
        </p>
      </div>

      <section className="word-chart" aria-label="近 14 天热度">
        {stats.daily.map((d) => (
          <div key={d.date} className="wc-col" title={`${d.date}：${d.n} 条`}>
            <span className="wc-n">{d.n || ''}</span>
            <span className="wc-bar" style={{ height: `${Math.max(3, (d.n / maxDaily) * 100)}%` }} />
            <span className="wc-d">{d.date.slice(5)}</span>
          </div>
        ))}
      </section>

      {coWords.length > 0 && (
        <section>
          <h2 className="daily-sec-title">共现热词</h2>
          <div className="daily-words">
            {coWords.map((w) => (
              <Link key={w.word} href={`/word/${encodeURIComponent(w.word)}`} className="daily-word">
                {w.word}<i>{w.count}</i>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="daily-sec-title">相关收录 <span className="daily-sec-count">{posts.length}</span></h2>
        {posts.length === 0 && <div className="empty">近 30 天暂无收录，换个热词试试。</div>}
        <div className="daily-list">
          {posts.map((p) => (
            <div className="daily-item" key={p.id}>
              <Link href={`/post/${p.id}`} className="daily-item-title">{p.title_zh || p.title}</Link>
              <span className="daily-item-meta">
                {p.source} · {p.category} · ▲{p.up - p.down} · <span suppressHydrationWarning>{timeAgo(p.created_at)}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
