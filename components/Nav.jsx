'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTrackInternalNav } from './BackLink';
import SubscribeEntry from './SubscribeEntry';
import { beijingNow } from '@/lib/time';

const LINKS = [
  { href: '/', label: '精选' },
  { href: '/hot', label: '热点' },
  { href: '/daily', label: '日报' },
  { href: '/all', label: '全部' },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState('');

  function onSearch(e) {
    e.preventDefault();
    const kw = q.trim();
    router.push(kw ? `/all?q=${encodeURIComponent(kw)}` : '/all');
  }

  // 刊头日期固定 UTC+8（与全站时间显示统一，不随浏览器/服务器时区漂移）
  const bj = beijingNow();
  const today = `${bj.getUTCFullYear()}年${bj.getUTCMonth() + 1}月${bj.getUTCDate()}日 星期${'日一二三四五六'[bj.getUTCDay()]}`;
  const isActive = (href) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  useTrackInternalNav();
  useEffect(() => {
    try {
      if (sessionStorage.getItem('tw-restore-scroll') !== '1') return;
      sessionStorage.removeItem('tw-restore-scroll');
      const saved = JSON.parse(sessionStorage.getItem('tw-scroll') || 'null');
      const here = `${window.location.pathname}${window.location.search}`;
      if (!saved || saved.path !== here || !Number.isFinite(saved.y)) return;
      const go = () => window.scrollTo(0, saved.y);
      go();
      requestAnimationFrame(go);
      setTimeout(go, 50);
    } catch { /* 没有可恢复的位置 */ }
  }, [pathname]);

  return (
    <header className="nav">
      <div className="container masthead-inner">
        <Link href="/" className="nav-logo">
          听潮<span className="kr-dot" /><span className="kr-sub">AI NEWS WIRE</span>
        </Link>
        <div className="masthead-right">
          <span className="masthead-date" suppressHydrationWarning>{today}</span>
          <SubscribeEntry />
          <form className="nav-search" onSubmit={onSearch} role="search">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              type="search"
              aria-label="搜索"
              placeholder="搜索…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>
        </div>
      </div>
      <div className="nav-bar">
        <div className="container nav-inner">
          <nav className="nav-links">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={isActive(l.href) ? 'active' : ''}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
