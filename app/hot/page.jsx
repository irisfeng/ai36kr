import Story from '@/components/Story';
import { listPosts } from '@/lib/queries';
import { alternates } from '@/lib/seo';

export const revalidate = 300;

export const metadata = {
  title: '热点',
  description: '当前 AI 圈讨论最多的事：按事件算热度，48 小时内每个独立信源只算一次，24 小时减半。',
  alternates: alternates('/hot'),
};

export default async function HotPage() {
  const posts = listPosts({ sort: 'hot', limit: 30 });
  return (
    <div className="container narrow">
      <div className="page-head">
        <h1>热点</h1>
        <p>按事件算，不按文章算：48 小时内每家独立信源只计一次，24 小时减半。一家媒体发十篇也只算一次。</p>
      </div>
      {posts.length === 0 && <div className="empty">近 48 小时还没有形成热点。</div>}
      <ol className="hot-list">
        {posts.map((p, i) => (
          <li key={p.id}>
            <span className={`hot-rank${i < 3 ? ' top' : ''}`}>{i + 1}</span>
            <Story post={p} />
          </li>
        ))}
      </ol>
    </div>
  );
}
