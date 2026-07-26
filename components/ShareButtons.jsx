'use client';

import { useEffect, useState } from 'react';

// 分享：移动端优先调系统分享；桌面提供 复制链接 / X / 微博 / Telegram
export default function ShareButtons({ title, text = '', path = '' }) {
  const [copied, setCopied] = useState(false);
  const [pageUrl, setPageUrl] = useState('');
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setPageUrl(`${window.location.origin}${path || window.location.pathname}`);
    setCanNativeShare(!!navigator.share);
  }, [path]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('复制链接：', pageUrl);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: text || title, url: pageUrl });
    } catch { /* 用户取消 */ }
  }

  const u = encodeURIComponent(pageUrl);
  const t = encodeURIComponent(title);
  const targets = [
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { label: '微博', href: `https://service.weibo.com/share/share.php?title=${t}&url=${u}` },
    { label: 'Telegram', href: `https://t.me/share/url?url=${u}&text=${t}` },
  ];

  return (
    <span className="share-bar">
      {canNativeShare ? (
        <button type="button" className="share-btn" onClick={nativeShare}>分享 ↗</button>
      ) : null}
      <button type="button" className="share-btn" onClick={copyLink}>
        {copied ? '已复制 ✓' : '复制链接'}
      </button>
      {targets.map((x) => (
        <a key={x.label} className="share-btn" href={x.href} target="_blank" rel="noopener noreferrer">
          {x.label}
        </a>
      ))}
    </span>
  );
}
