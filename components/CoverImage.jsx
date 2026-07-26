'use client';

import { useState } from 'react';

// 缩略图：加载失败（防盗链 403、超时等）时静默隐藏，露出底层渐变封面
export default function CoverImage({ src, alt = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
