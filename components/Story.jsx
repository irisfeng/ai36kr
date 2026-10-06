import Link from 'next/link';
import { timeAgo, timeHM } from '@/lib/time';
import { TIER_LABEL } from '@/lib/editorial';

export const titleOf = (p) => p.title_zh || p.title;
export const summaryOf = (p) => {
  const s = p.summary_zh || p.summary || '';
  // 入库时无摘要的条目用标题顶替过摘要：不重复显示
  // HN 条目的「N 分 / N 条评论」不是摘要（热度另在来源行显示）；不到一句话的（多半是 RSS 里的栏目名）也不显示
  return s.length >= 12 && s !== p.title && s !== p.title_zh && !s.startsWith('HN 热议') ? s : '';
};

// 「同一件事还有谁在报」：读者只看到一次，但看得到报道面
export function Coverage({ post }) {
  if (!post.coverage?.length) return null;
  const seen = new Set([post.source]);
  const others = post.coverage.filter((c) => !seen.has(c.source) && seen.add(c.source));
  if (!others.length) return null;
  return (
    <p className="story-coverage">
      <span className="cov-count">{others.length + 1} 家在报</span>
      {others.slice(0, 4).map((c) => (
        <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer">{c.source}</a>
      ))}
      {others.length > 4 ? <span>等</span> : null}
    </p>
  );
}

// 一条新闻：来源行 + 标题 + 答案先行的摘要 + 报道面。纯文字，不配图。
export default function Story({ post, lead = false, clock = false }) {
  const summary = summaryOf(post);
  return (
    <article className={`story${lead ? ' story-lead' : ''}`}>
      <div className="story-meta">
        <span className={`story-source tier-${post.tier || 'T2'}`}>{post.source}</span>
        {post.tier === 'T1' ? <span className="story-tier">{TIER_LABEL.T1}</span> : null}
        <span>{post.category}</span>
        <time dateTime={post.created_at} suppressHydrationWarning>
          {clock ? timeHM(post.created_at) : timeAgo(post.created_at)}
        </time>
        {post.ext_score > 0 ? <span className="story-hn">HN {post.ext_score}</span> : null}
        {Number.isFinite(post.score) ? <span className="story-score" title="编辑评分">{post.score}</span> : null}
      </div>
      <h2 className="story-title">
        <Link href={`/post/${post.id}`}>{titleOf(post)}</Link>
      </h2>
      {summary ? <p className="story-summary">{summary}</p> : null}
      <Coverage post={post} />
    </article>
  );
}

// 单行条目：全部动态、日报简讯、热点榜用
export function StoryRow({ post, rank = null, clock = true }) {
  return (
    <div className={`row${post.noise ? ' row-noise' : ''}`}>
      {rank !== null ? <span className="row-rank">{rank}</span> : null}
      <time className="row-time" dateTime={post.created_at} suppressHydrationWarning>
        {clock ? timeHM(post.created_at) : timeAgo(post.created_at)}
      </time>
      <Link href={`/post/${post.id}`} className="row-title">{titleOf(post)}</Link>
      <span className="row-source">
        {post.selected ? <i className="row-pick" title="精选" /> : null}
        {post.source}{post.src_count > 1 ? ` +${post.src_count - 1}` : ''}
      </span>
    </div>
  );
}
