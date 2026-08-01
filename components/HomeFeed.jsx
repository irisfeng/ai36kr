'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PostCard from './PostCard';

const TABS = [
  { key: 'hot', label: '热度' },
  { key: 'new', label: '最新' },
  { key: 'deep', label: '深度长读' },
];
const PAGE_SIZE = 50;

// 首页信息流：默认「热度」由服务端 ISR 静态直出（300s 边缘缓存），
// 切 tab / 搜索 / 分类 / 翻页时客户端改打动态 API，首页壳不再重复计算
export default function HomeFeed({ initialPosts }) {
  const sp = useSearchParams();
  const sort = ['hot', 'new', 'deep'].includes(sp.get('sort')) ? sp.get('sort') : 'hot';
  const cat = sp.get('cat') || '';
  const q = (sp.get('q') || '').trim();
  const requestedPage = Number(sp.get('page'));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 200 ? requestedPage : 1;

  const isDefault = sort === 'hot' && !cat && !q && page === 1;
  const [posts, setPosts] = useState(initialPosts);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isDefault) {
      setPosts(initialPosts);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ sort, limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) });
    if (cat) params.set('cat', cat);
    if (q) params.set('q', q);
    fetch(`/api/posts?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) {
          setPosts(Array.isArray(data) ? data : data.posts || []);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sort, cat, q, page, isDefault, initialPosts]);

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
    <>
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
      {loading && <div className="empty">加载中…</div>}
      {!loading && posts.length === 0 && <div className="empty">没有找到相关内容，换个关键词试试。</div>}
      {!loading && posts.map((p) => <PostCard key={p.id} post={p} />)}
      {!loading && (page > 1 || posts.length === PAGE_SIZE) && (
        <nav className="tabs" aria-label="文章翻页" style={{ justifyContent: 'space-between', marginTop: 24 }}>
          <span>{page > 1 ? <Link href={pageHref(page - 1)}>← 上一页</Link> : null}</span>
          <span>{posts.length === PAGE_SIZE ? <Link href={pageHref(page + 1)}>下一页 →</Link> : null}</span>
        </nav>
      )}
    </>
  );
}


// SSR 静态版信息流：不含任何 hook，用作 Suspense fallback，
// 保证首屏 HTML 带完整文章卡片（SEO / 首屏 / 内容断言）
export function FeedStatic({ posts }) {
  return (
    <>
      <nav className="tabs">
        <Link href="/" className="active">热度</Link>
        <Link href="/?sort=new">最新</Link>
        <Link href="/?sort=deep">深度长读</Link>
      </nav>
      {posts.map((p) => <PostCard key={p.id} post={p} />)}
      {posts.length === 50 && (
        <nav className="tabs" aria-label="文章翻页" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
          <Link href="/?page=2">下一页 →</Link>
        </nav>
      )}
    </>
  );
}
