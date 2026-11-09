'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { shouldGoBack } from '@/lib/back-nav';

const NAV_KEY = 'tw-internal-nav';
const SCROLL_KEY = 'tw-scroll';
const RESTORE_KEY = 'tw-restore-scroll';

// 从列表点进文章时记下「这一跳发生在站内」。直接打开文章链接时没有这个标记。
export function markInternalNav() {
  try { sessionStorage.setItem(NAV_KEY, '1'); } catch { /* 隐私模式写不了，退回 referrer */ }
}

export function cameFromThisSite() {
  try {
    if (sessionStorage.getItem(NAV_KEY) === '1') return true;
    if (!document.referrer) return false;
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function useTrackInternalNav() {
  useEffect(() => {
    function onClick(event) {
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('data-back-link')) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        markInternalNav();
        if (url.pathname.startsWith('/post/')) {
          sessionStorage.setItem(SCROLL_KEY, JSON.stringify({
            path: `${window.location.pathname}${window.location.search}`,
            y: window.scrollY,
          }));
        }
      } catch { /* 忽略 javascript: 等无效链接 */ }
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
}

export default function BackLink({ fallback = '/', children = '返回' }) {
  const router = useRouter();

  function onClick(event) {
    event.preventDefault();
    if (shouldGoBack({ fromSite: cameFromThisSite(), historyLength: window.history.length })) {
      try { sessionStorage.setItem(RESTORE_KEY, '1'); } catch { /* 写不了就只做返回 */ }
      router.back();
    } else router.push(fallback);
  }

  return (
    <a className="back-link" href={fallback} data-back-link="" onClick={onClick}>
      <span aria-hidden="true">←</span>
      {children}
    </a>
  );
}
