import Link from 'next/link';
import PostCard from '@/components/PostCard';
import SubscribeForm from '@/components/SubscribeForm';
import { listPosts, weeklyTopPosts, latestFlashes, topProducts } from '@/lib/queries';
import { CATEGORIES } from '@/lib/categories';
import { timeAgo, timeHM } from '@/lib/time';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'hot', label: '热度' },
  { key: 'new', label: '最新' },
  { key: 'deep', label: '深度长读' },
];
const PAGE_SIZE = 50;

export default async function HomePage({ searchParams }) {
  // Next 15+：searchParams 是 Promise，必须 await，同步访问全部得到 undefined
  const sp = await searchParams;
  const sort = ['hot', 'new', 'deep'].includes(sp.sort) ? sp.sort : 'hot';
  const cat = sp.cat || '';
  const q = (sp.q || '').trim();
  const requestedPage = Number(sp.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 200
    ? requestedPage
    : 1;

  const posts = listPosts({ sort, cat, q, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const hot5 = weeklyTopPosts(5);
  const flashes = latestFlashes(5);
  const products = topProducts(3);

  function tabHref(key) {
    const p = new URLSearchParams();
    if (key !== 'hot') p.set('sort', key);
    if (cat) p.set('cat', cat);
    return `/?${p.toString()}`;
  }

  function pageHref(nextPage) {
    const p = new URLSearchParams();
    if (sort !== 'hot') p.set('sort', sort);
    if (cat) p.set('cat', cat);
    if (q) p.set('q', q);
    if (nextPage > 1) p.set('page', String(nextPage));
    return `/?${p.toString()}`;
  }

  return (
    <div className="container page-grid">
      <main className="main-col">
        {q ? (
          <div className="page-head" style={{ paddingTop: 0 }}>
            <h1 style={{ fontSize: 22 }}>「{q}」的搜索结果</h1>
            <p>第 {page} 页 · 本页 {posts.length} 篇 · <Link href="/" style={{ color: 'var(--accent)' }}>清除搜索</Link></p>
          </div>
        ) : (
          <nav className="tabs">
            {TABS.map((t) => (
              <Link key={t.key} href={tabHref(t.key)} className={sort === t.key && !q ? 'active' : ''}>
                {t.label}
              </Link>
            ))}
            {cat && (
              <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 13, color: 'var(--ink-3)' }}>
                分类：{cat} · <Link href="/" style={{ color: 'var(--accent)' }}>取消筛选</Link>
              </span>
            )}
          </nav>
        )}
        {posts.length === 0 && <div className="empty">没有找到相关内容，换个关键词试试。</div>}
        {posts.map((p) => <PostCard key={p.id} post={p} />)}
        {(page > 1 || posts.length === PAGE_SIZE) && (
          <nav className="tabs" aria-label="文章翻页" style={{ justifyContent: 'space-between', marginTop: 24 }}>
            <span>{page > 1 ? <Link href={pageHref(page - 1)}>← 上一页</Link> : null}</span>
            <span>{posts.length === PAGE_SIZE ? <Link href={pageHref(page + 1)}>下一页 →</Link> : null}</span>
          </nav>
        )}
      </main>

      <aside className="side-col">
        <section className="side-card">
          <h3 className="side-title">7×24 快讯 <Link className="side-more" href="/flashes">全部 →</Link></h3>
          <div className="flash-mini-list">
            {flashes.map((f) => (
              <div className="flash-mini" key={f.id}>
                <span className="flash-time" suppressHydrationWarning>{timeHM(f.created_at)} · {timeAgo(f.created_at)}</span>
                <span className={`flash-tag tag-${f.tag}`}>{f.tag}</span>
                {f.content.length > 46 ? f.content.slice(0, 46) + '…' : f.content}
              </div>
            ))}
          </div>
        </section>

        <section className="side-card side-subscribe">
          <h3 className="side-title"><span className="ss-seal">听</span> 订阅听潮</h3>
          <p className="ss-pitch">每日 8 点，一页看懂 AI 圈</p>
          <SubscribeForm />
          <div className="ss-links">
            <a href="/rss.xml" target="_blank" rel="noopener noreferrer">RSS</a>
            <Link href="/daily">今日一页</Link>
            <Link href="/flashes">快讯</Link>
          </div>
        </section>

        <section className="side-card">
          <h3 className="side-title">本周热榜</h3>
          <div className="rank-list">
            {hot5.map((p, i) => (
              <div className="rank-item" key={p.id}>
                <span className="rank-num">{i + 1}</span>
                <Link href={`/post/${p.id}`}>{p.title_zh || p.title}</Link>
                <span className="rank-heat">{p.up - p.down}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="side-card">
          <h3 className="side-title">AI 新品榜 <Link className="side-more" href="/launch">查看 →</Link></h3>
          {products.map((p, i) => (
            <div className="product-mini" key={p.id}>
              <span className={`p-rank r${i + 1}`}>{i + 1}</span>
              <div>
                <div className="p-name">{p.name}</div>
                <div className="p-tagline">{p.tagline}</div>
              </div>
              <span className="p-up">▲ {p.up}</span>
            </div>
          ))}
        </section>

        <section className="side-card">
          <h3 className="side-title">分类导航</h3>
          <div className="cat-nav">
            {CATEGORIES.map((c) => (
              <Link key={c} href={`/?cat=${encodeURIComponent(c)}`}>{c}</Link>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
