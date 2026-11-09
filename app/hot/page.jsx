import Story from '@/components/Story';
import Breadcrumb from '@/components/Breadcrumb';
import { listPosts } from '@/lib/queries';
import { itemListJsonLd, jsonLdScript, pageMetadata, storyListItems } from '@/lib/seo';

export const revalidate = 300;

const TITLE = '近 48 小时 AI 热点';
const DESCRIPTION = '按事件计算的 AI 热点：48 小时内每个独立信源只计一次，24 小时减半。一家媒体发多篇也只算一次。';

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: '/hot',
});

export default async function HotPage() {
  const posts = listPosts({ sort: 'hot', limit: 30 });
  return (
    <div className="container narrow">
      <div className="page-head">
        <Breadcrumb items={[
          { name: '精选', href: '/' },
          { name: TITLE, href: '/hot', current: true },
        ]} />
        <h1>{TITLE}</h1>
        <p>{DESCRIPTION}</p>
      </div>
      {posts.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(itemListJsonLd({ name: TITLE, url: '/hot', items: storyListItems(posts) })) }}
        />
      )}
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
