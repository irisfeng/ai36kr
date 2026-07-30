'use client';

import { useState } from 'react';

// 微信分享卡片：服务端直接生成 SVG 海报（/api/sharecard/[id].svg），
// 不再用 html2canvas 客户端截图（移动端会卡死在「正在生成图片…」）
export default function ShareCard({ post }) {
  const [open, setOpen] = useState(false);
  const posterUrl = `/api/sharecard/${post.id}.svg?v=2`; // v=N 破边缘/浏览器缓存

  function close() { setOpen(false); }

  return (
    <>
      <button type="button" className="share-btn" onClick={() => setOpen(true)}>卡片 ▦</button>
      {open && (
        <div className="modal-mask" onClick={close}>
          <div className="sharecard-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sharecard-modal-head">
              <b>微信分享卡片</b>
              <button type="button" className="sharecard-close" onClick={close}>×</button>
            </div>
            <img className="sharecard-poster" src={posterUrl} alt="分享卡片" />
            <p className="sharecard-hint">长按图片保存，发送到朋友圈或好友</p>
            <p className="sharecard-hint">
              <a href={posterUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)' }}>
                在新窗口打开原图 ↗
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
