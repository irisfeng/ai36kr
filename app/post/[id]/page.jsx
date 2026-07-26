import { notFound } from 'next/navigation';
import VoteButtons from '@/components/VoteButtons';
import ReactionBar from '@/components/ReactionBar';
import CoverImage from '@/components/CoverImage';
import CommentSection from '@/components/CommentSection';
import { getPost, listComments } from '@/lib/queries';
import { coverFor } from '@/lib/categories';
import { timeAgo } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default function PostPage({ params }) {
  const post = getPost(Number(params.id));
  if (!post) notFound();

  return (
    <div className="container">
      <article className="article">
        <div className="article-meta">
          <span className="post-source">{post.source}</span>
          <span className="post-cat-tag">{post.category}</span>
          {post.is_deep ? <span className="post-deep-tag">深度长读</span> : null}
          <span suppressHydrationWarning>{timeAgo(post.created_at)}</span>
        </div>
        <h1>{post.title}</h1>
        <div className="article-summary">
          <b>摘要 · </b>{post.summary}
        </div>
        {post.is_external && post.url ? (
          <a className="ext-link-btn" href={post.url} target="_blank" rel="noopener noreferrer">
            阅读原文 · {post.source} →
          </a>
        ) : null}
        <div className="article-cover" style={{ background: coverFor(post) }}>
          <CoverImage src={post.image_url} alt={post.title} className="cover-img" />
          <span className="cover-cat">{post.category}</span>
        </div>
        <div className="article-content">
          {post.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <div className="article-actions">
          <VoteButtons targetType="post" targetId={post.id} initialUp={post.up} initialDown={post.down} />
          <ReactionBar postId={post.id} initialCounts={post.reactions || {}} size="lg" />
          <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
            {post.comment_count} 条评论 · 观点来自社区
          </span>
        </div>
      </article>
      <CommentSection postId={post.id} />
    </div>
  );
}
