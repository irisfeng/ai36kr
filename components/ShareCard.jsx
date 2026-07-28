'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { dateGroup } from '@/lib/time';
import { coverFor, coverInk } from '@/lib/categories';

// 微信分享卡片：报纸风海报（图 + 文 + 角落二维码），html2canvas 转 PNG，长按保存发朋友圈
export default function ShareCard({ post }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState('');
  const [poster, setPoster] = useState('');
  const [failed, setFailed] = useState(false);
  const cardRef = useRef(null);
  const imgRef = useRef(null);

  const postUrl = `https://aikr.shddai.net/post/${post.id}`;
  const title = post.title_zh || post.title;
  const dateStr = dateGroup(post.created_at); // 海报日期统一 UTC+8

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(postUrl, {
      width: 300, margin: 0,
      color: { dark: '#191813', light: '#00000000' },
    }).then(setQr).catch(() => {});
  }, [open, postUrl]);

  // 等封面图与衬线字体就绪后生成海报
  useEffect(() => {
    if (!open || !qr || poster) return;
    let cancelled = false;
    (async () => {
      try {
        await Promise.race([
          (async () => {
            await document.fonts.ready;
            if (imgRef.current) {
              if (!imgRef.current.complete) {
                await new Promise((res, rej) => {
                  imgRef.current.onload = res;
                  imgRef.current.onerror = rej;
                });
              }
              if (imgRef.current.naturalWidth === 0) throw new Error('cover broken');
            }
          })(),
          new Promise((res) => setTimeout(res, 5000)),
        ]);
      } catch { /* 封面失败则去掉图继续 */ }
      if (cancelled) return;
      try {
        const { default: html2canvas } = await import('html2canvas');
        const canvas = await html2canvas(cardRef.current, {
          scale: 2,
          backgroundColor: '#F5F3ED',
          logging: false,
        });
        if (!cancelled) setPoster(canvas.toDataURL('image/png'));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [open, qr, poster]);

  function close() {
    setOpen(false);
    setPoster('');
    setFailed(false);
  }

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

            {poster ? (
              <>
                <img className="sharecard-poster" src={poster} alt="分享卡片" />
                <p className="sharecard-hint">长按图片保存，发送到朋友圈或好友</p>
              </>
            ) : (
              <>
                <div className="sharecard" ref={cardRef}>
                  <div className="sc-head">
                    <span className="sc-seal">听</span>
                    <span className="sc-brand">听潮<span className="sc-wire">AI NEWS WIRE</span></span>
                    <span className="sc-date">{dateStr}</span>
                  </div>
                  {post.image_url ? (
                    <div className="sc-cover" style={{ background: coverFor(post) }}>
                      <img ref={imgRef} src={`/api/img?u=${encodeURIComponent(post.image_url)}`} alt="" />
                      <span className="sc-cat">{post.category}</span>
                    </div>
                  ) : (
                    <div className="sc-cover" style={{ background: coverFor(post) }}>
                      <span className="sc-wm" style={{ color: coverInk(post) }}>{(post.category || 'AI')[0]}</span>
                    </div>
                  )}
                  <div className="sc-body">
                    <h1 className="sc-title">{title}</h1>
                    {post.title_zh ? <p className="sc-orig">{post.title}</p> : null}
                    <p className="sc-summary">{post.summary}</p>
                    <p className="sc-meta">{post.source} · {post.category}</p>
                  </div>
                  <div className="sc-foot">
                    {qr ? <img className="sc-qr" src={qr} alt="二维码" /> : <span className="sc-qr" />}
                    <div className="sc-foot-text">
                      <b>扫码阅读原文</b>
                      <span>听潮 TideWire · aikr.shddai.net</span>
                    </div>
                  </div>
                </div>
                <p className="sharecard-hint">
                  {failed ? '图片生成失败，可直接截图分享此卡片' : '正在生成图片…'}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
