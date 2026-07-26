import Link from 'next/link';
import ShareButtons from '@/components/ShareButtons';
import SubscribeForm from '@/components/SubscribeForm';
import { timeAgo } from '@/lib/time';

// 「今日一页」共用视图：/daily（24h 窗口）与 /daily/[date]（日历日归档）复用
export default function DailyView({
  posts, words, top3,
  headTitle = '今日一页', headDesc,
  shareTitle, shareText, sharePath = '/daily',
  navPrev = null, navNext = null,
}) {
  const attentionCount = (p) => Object.values(p.reactions || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="container daily-wrap">
      <div className="page-head daily-head">
        <h1>{headTitle}</h1>
        <p suppressHydrationWarning>{headDesc}</p>
        <div className="daily-share">
          <ShareButtons title={shareTitle} text={shareText} path={sharePath} />
          <a className="share-btn" href="/daily-card.html" target="_blank" rel="noopener noreferrer">
            今日头条海报 ↗
          </a>
          <span className="daily-subscribe">
            <SubscribeForm compact />
          </span>
        </div>
        {(navPrev || navNext) && (
          <nav className="daily-nav">
            {navPrev ? <Link href={navPrev}>← 前一天</Link> : <span />}
            {navNext ? <Link href={navNext}>后一天 →</Link> : <span />}
          </nav>
        )}
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
          <h2 className="daily-sec-title">{headTitle === '今日一页' ? '今日最受关注' : '当日最受关注'}</h2>
          <div className="daily-top-grid">
            {top3.map((p, i) => (
              <Link key={p.id} href={`/post/${p.id}`} className="daily-top-card">
                <span className={`daily-top-rank r${i + 1}`}>{i + 1}</span>
                <span className="daily-top-title">{p.title_zh || p.title}</span>
                <span className="daily-top-meta">
                  {p.source} · ▲{p.up - p.down} · {attentionCount(p)} 个反应
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {posts.length === 0 && <div className="empty">这一天还没有收录任何内容。</div>}

      <Groups posts={posts} />
    </div>
  );
}

import { CATEGORIES } from '@/lib/categories';

function Groups({ posts }) {
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

  return groups.map(([cat, items]) => (
    <section className="daily-group" key={cat}>
      <h2 className="daily-sec-title">{cat}<span className="daily-sec-count">{items.length}</span></h2>
      <div className="daily-list">
        {items.map((p) => (
          <div className="daily-item" key={p.id}>
            <Link href={`/post/${p.id}`} className="daily-item-title">{p.title_zh || p.title}</Link>
            <span className="daily-item-meta">
              {p.source}
              {p.is_external ? ' ↗' : ''}
              {' · '}<span suppressHydrationWarning>{timeAgo(p.created_at)}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  ));
}
