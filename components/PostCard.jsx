import Link from 'next/link';
import VoteButtons from './VoteButtons';
import ReactionBar from './ReactionBar';
import CoverImage from './CoverImage';
import { timeAgo } from '@/lib/time';
import { coverFor, coverInk } from '@/lib/categories';

export default function PostCard({ post }) {
  return (
    <article className="post-card">
      <Link
        href={`/post/${post.id}`}
        className="post-cover"
        data-wm={(post.category || 'AI')[0]}
        style={{ background: coverFor(post), '--wm-ink': coverInk(post) }}
      >
        <CoverImage src={post.image_url} alt={post.title} className="cover-img" />
        <span className="cover-cat">{post.category}</span>
      </Link>
      <div className="post-body">
        <div className="post-meta">
          <span className="post-source">{post.source}</span>
          <span className="post-cat-tag">{post.category}</span>
          {post.is_deep ? <span className="post-deep-tag">深度长读</span> : null}
          {(post.up - post.down) >= 150 ? <span className="hot-badge">HOT</span> : null}
        </div>
        <h2 className="post-title">
          <Link href={`/post/${post.id}`}>{post.title_zh || post.title}</Link>
        </h2>
        {post.title_zh ? <p className="post-title-orig">{post.title}</p> : null}
        <p className="post-summary">{post.summary_zh || post.summary}</p>
        <div className="post-actions">
          <VoteButtons targetType="post" targetId={post.id} initialUp={post.up} initialDown={post.down} />
          <Link href={`/post/${post.id}#comments`} className="comment-link">
            评论 {post.comment_count ?? 0}
          </Link>
          <ReactionBar postId={post.id} initialCounts={post.reactions || {}} />
          <span className="post-time" suppressHydrationWarning>{timeAgo(post.created_at)}</span>
        </div>
      </div>
    </article>
  );
}
