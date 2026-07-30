'use client';

import { useRef, useState } from 'react';

// 缩略图：加载失败（防盗链 403、过期签名 URL、超时等）时，
// 在 img 仍在 DOM 的瞬间把卡片退化为 no-cover 纯文字卡，再隐藏自身——不留空白图框
export default function CoverImage({ src, alt = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef(null);

  function handleError() {
    const card = imgRef.current?.closest('.post-card, .article');
    if (card) card.classList.add('no-cover');
    setFailed(true);
  }

  if (!src || failed) return null;
  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={handleError}
    />
  );
}
