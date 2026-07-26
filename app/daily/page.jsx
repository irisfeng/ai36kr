import Link from 'next/link';
import { listPosts } from '@/lib/queries';
import { hotWords } from '@/lib/keywords';
import { CATEGORIES } from '@/lib/categories';
import { timeAgo, dateGroup } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const metadata = { title: '今日一页 - 听潮' };

// 综合关注度 = 净投票 + 表情反应总数
function attention(p) {
  const reactions = Object.values(p.reactions || {}).reduce((a, b) => a + b, 0);
  return (p.up - p.down) + reactions;
}

export default function DailyPage() {
  // 优雅降级：24h 无数据时展示最近 48h
  let windowH = 24;
  let posts = listPosts({ sort: 'new', sinceHours: 24 });
  if (posts.length === 0) {
    windowH = 48;
    posts = listPosts({ sort: 'new', sinceHours: 48 });
  }

  const words = hotWords(posts, 12);
  const top3 = [...posts].sort((a, b) => attention(b) - attention(a)).slice(0, 3);

  const groups = [];
  const byCat = new Map();
  for (const p of posts) {
    if (!byCat.has(p.category)) byCat.set(p.category, []);
    byCat.get(p.category).push(p);
  }
  for (const c of CATEGORIES) {
    if (byCat.has(c)) groups.push([c, byCat.get(c)]);
    byCat.delete(c);
  }
  for (const rest of byCat) groups.push(rest);

  return (
    <div className="container daily-wrap">
      <div className="page-head daily-head">
        <h1>今日一页</h1>
        <p suppressHydrationWarning>
          {dateGroup(new Date().toISOString())} · 最近 {windowH} 小时收录 {posts.length} 条
          {windowH === 48 && '（24 小时内暂无更新，已扩展至 48 小时）'}
        </p>
      </div>

      {words.length > 0 && (
        <div className="daily-words">
          {words.map((w) => (
            <Link key={w.word} href={`/?q=${encodeURIComponent(w.word)}`} className="daily-word">
              {w.word}<i>{w.count}</i>
            </Link>
          ))}
        </div>
      )}

      {top3.length > 0 && (
        <section className="daily-top">
          <h2 className="daily-sec-title">今日最受关注</h2>
          <div className="daily-top-grid">
            {top3.map((p, i) => (
              <Link key={p.id} href={`/post/${p.id}`} className="daily-top-card">
                <span className={`daily-top-rank r${i + 1}`}>{i + 1}</span>
                <span className="daily-top-title">{p.title}</span>
                <span className="daily-top-meta">
                  {p.source} · ▲{p.up - p.down} · {Object.values(p.reactions || {}).reduce((a, b) => a + b, 0)} 个反应
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {posts.length === 0 && <div className="empty">最近 48 小时还没有收录任何内容。</div>}

      {groups.map(([cat, items]) => (
        <section className="daily-group" key={cat}>
          <h2 className="daily-sec-title">{cat}<span className="daily-sec-count">{items.length}</span></h2>
          <div className="daily-list">
            {items.map((p) => (
              <div className="daily-item" key={p.id}>
                <Link href={`/post/${p.id}`} className="daily-item-title">{p.title}</Link>
                <span className="daily-item-meta">
                  {p.source}
                  {p.is_external ? ' ↗' : ''}
                  {' · '}<span suppressHydrationWarning>{timeAgo(p.created_at)}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
