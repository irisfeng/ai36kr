import Link from 'next/link';
import { cache } from 'react';
import db from '@/lib/db';
import { hotWords } from '@/lib/keywords';
import { dateGroup } from '@/lib/time';

export const dynamic = 'force-dynamic';

const SITE = 'https://aikr.shddai.net';
const DAY = 86400000;

// 近 7 天（滚动）热词榜 + 与上一周期（前 7 天）名次对比。
// React cache：generateMetadata 与页面共享同一次计算（每请求只算一遍）
const getWeeklyData = cache(() => {
  const since7 = new Date(Date.now() - 7 * DAY).toISOString();
  const since14 = new Date(Date.now() - 14 * DAY).toISOString();
  const posts = db.prepare(
    'SELECT id, title, title_zh, summary, summary_zh, source, created_at FROM posts WHERE created_at >= ? ORDER BY created_at DESC LIMIT 3000'
  ).all(since7);
  const prevPosts = db.prepare(
    'SELECT title, title_zh, summary, summary_zh FROM posts WHERE created_at >= ? AND created_at < ? LIMIT 3000'
  ).all(since14, since7);

  // 语料优先取中文译文：英文条目的中文实体也能命中中文热词，且每个帖只计一份不重复
  const corpusOf = (list) => list.map((p) => ({
    ...p,
    title: p.title_zh || p.title,
    summary: p.summary_zh || p.summary,
  }));
  const words = hotWords(corpusOf(posts), 20);
  const prevWords = hotWords(corpusOf(prevPosts), 50);
  const prevRank = new Map(prevWords.map((w, i) => [w.word, i + 1]));

  // 前 10 名各带 2 条相关收录（页面内链，也是搜索引擎的上下文）
  const findRelated = (word) => db.prepare(
    `SELECT id, title, title_zh, source, created_at FROM posts
     WHERE created_at >= ? AND (title LIKE ? OR title_zh LIKE ? OR summary LIKE ? OR summary_zh LIKE ?)
     ORDER BY created_at DESC LIMIT 2`
  ).all(since7, `%${word}%`, `%${word}%`, `%${word}%`, `%${word}%`);

  const items = words.map((w, i) => ({
    ...w,
    rank: i + 1,
    prev: prevRank.get(w.word) ?? null,
    related: i < 10 ? findRelated(w.word) : [],
  }));
  return { items, total: posts.length, since: since7 };
});

export async function generateMetadata() {
  const { items, total } = getWeeklyData();
  const top3 = items.slice(0, 3).map((w) => w.word).join(' / ');
  return {
    title: '本周 AI 热词榜',
    description: `近 7 天收录 ${total} 条 AI 资讯，热词 Top3：${top3}。完整 Top20 榜单、名次变化与相关收录。`,
  };
}

function Delta({ prev, rank }) {
  const base = { fontFamily: 'Menlo, monospace', fontSize: 11, flexShrink: 0 };
  if (prev == null) {
    return <span style={{ ...base, color: '#C23B22', border: '1px solid #C23B22', padding: '1px 5px' }}>NEW</span>;
  }
  const d = prev - rank;
  if (d > 0) return <span style={{ ...base, color: '#C23B22' }}>▲{d}</span>;
  if (d < 0) return <span style={{ ...base, color: '#8B8574' }}>▼{-d}</span>;
  return <span style={{ ...base, color: '#8B8574' }}>—</span>;
}

export default function WeeklyPage() {
  const { items, total, since } = getWeeklyData();
  const range = `${dateGroup(since)} – ${dateGroup(new Date().toISOString())}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '本周 AI 热词榜',
    description: `近 7 天收录 ${total} 条 AI 资讯的热词 Top20（听潮 TideWire 原创统计）`,
    inLanguage: 'zh-CN',
    itemListElement: items.map((w) => ({
      '@type': 'ListItem',
      position: w.rank,
      name: w.word,
      url: `${SITE}/?q=${encodeURIComponent(w.word)}`,
    })),
  };

  return (
    <div className="container" style={{ maxWidth: 780 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="page-head">
        <h1>本周 AI 热词榜</h1>
        <p>{range} · 收录 {total} 条 · 名次与上一周期（前 7 天）对比</p>
      </div>

      <ol style={{ listStyle: 'none', margin: '8px 0 32px', padding: 0 }}>
        {items.map((w) => (
          <li key={w.word} style={{ borderBottom: '1px solid var(--line)', padding: '14px 2px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
              <span style={{
                fontFamily: 'Menlo, monospace', fontSize: 15, width: 26, flexShrink: 0,
                color: w.rank === 1 ? '#C23B22' : w.rank <= 3 ? '#191813' : '#8B8574',
                fontWeight: w.rank <= 3 ? 600 : 400,
              }}>
                {String(w.rank).padStart(2, '0')}
              </span>
              <span style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 21 }}>{w.word}</span>
              <span style={{ fontFamily: 'Menlo, monospace', fontSize: 11, color: '#8B8574' }}>{w.count} 次</span>
              <span style={{ marginLeft: 'auto' }}><Delta prev={w.prev} rank={w.rank} /></span>
            </div>
            {w.related?.length ? (
              <div style={{ margin: '7px 0 0 40px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {w.related.map((p) => (
                  <Link key={p.id} href={`/post/${p.id}`} style={{ fontSize: 13, color: '#4B463A' }}>
                    {p.title_zh || p.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <p style={{ fontSize: 12, color: '#8B8574', lineHeight: 1.9, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        统计口径：近 7 天收录的 {total} 条标题与摘要（含 LLM 译文），按 AI 领域词典词频排序，滚动更新。
        想每天收到热词与 Top3？<Link href="/daily" style={{ color: '#C23B22' }}>订阅「今日 AI 一页」日报 →</Link>
      </p>
    </div>
  );
}
