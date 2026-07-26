'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import SubscribeEntry from './SubscribeEntry';

const LINKS = [
  { href: '/', label: '首页' },
  { href: '/daily', label: '今日' },
  { href: '/flashes', label: '快讯' },
  { href: '/launch', label: '新品榜' },
  { href: '/submit', label: '投稿' },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState('');

  function onSearch(e) {
    e.preventDefault();
    const kw = q.trim();
    if (kw) router.push(`/?q=${encodeURIComponent(kw)}`);
    else router.push('/');
  }

  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  return (
    <header className="nav">
      <div className="container masthead-inner">
        <Link href="/" className="nav-logo">
          听潮<span className="kr-dot" /><span className="kr-sub">AI NEWS WIRE</span>
        </Link>
        <div className="masthead-right">
          <span className="masthead-date" suppressHydrationWarning>{today}</span>
          <SubscribeEntry />
          <form className="nav-search" onSubmit={onSearch}>
            <span className="search-icon">⌕</span>
            <input
              type="search"
              placeholder="搜索标题 / 摘要…"
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
              <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
