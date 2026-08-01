import Link from 'next/link';
import { Suspense } from 'react';
import SubscribeForm from '@/components/SubscribeForm';
import HomeFeed, { FeedStatic } from '@/components/HomeFeed';
import { listPosts, weeklyTopPosts, latestFlashes, topProducts } from '@/lib/queries';
import { CATEGORIES } from '@/lib/categories';
import { timeAgo, timeHM } from '@/lib/time';

// 首页 = 可缓存静态壳（ISR 300s）+ 客户端动态信息流：
// 默认「热度」由本文件静态直出并边缘缓存 5 分钟，大多数请求不触发 Function/Turso；
// Suspense fallback 渲染完整文章列表（SEO/首屏有真实内容），
// 切 tab / 搜索 / 分类 / 翻页由 HomeFeed 客户端改打 /api/posts
export const revalidate = 300;

export default async function HomePage() {
  const [posts, hot5, flashes, products] = await Promise.all([
    listPosts({ sort: 'hot', limit: 50, offset: 0 }),
    weeklyTopPosts(5),
    latestFlashes(5),
    topProducts(3),
  ]);

  return (
    <div className="container page-grid">
      <main className="main-col">
        <Suspense fallback={<FeedStatic posts={posts} />}>
          <HomeFeed initialPosts={posts} />
        </Suspense>
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
