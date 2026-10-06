'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import SubscribeForm from './SubscribeForm';

const RSS_URL = 'https://aikr.shddai.net/rss.xml';

// 「订阅」入口：导航按钮 → 报纸风弹层（邮箱日报 + RSS + 分享卡片说明）
// 注意：父级 .nav 带 backdrop-filter 会形成包含块，弹层必须 portal 到 body 才能真正 fixed 全屏
export default function SubscribeEntry() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function copyRss() {
    try {
      await navigator.clipboard.writeText(RSS_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('RSS 地址：', RSS_URL);
    }
  }

  const modal = open ? (
    <div className="modal-mask" onClick={() => setOpen(false)}>
      <div className="modal subscribe-modal" role="dialog" aria-modal="true" aria-label="订阅听潮" onClick={(e) => e.stopPropagation()}>
        <div className="sm-head">
          <span className="sm-seal">听</span>
          <div>
            <b>订阅听潮</b>
            <p>每日 8 点，一页看懂 AI 圈</p>
          </div>
          <button type="button" className="sharecard-close" aria-label="关闭" onClick={() => setOpen(false)}>×</button>
        </div>
        <div className="sm-row">
          <div className="sm-row-title"><span className="sm-mark" />邮箱日报</div>
          <SubscribeForm />
          <p className="sm-note">头条、看点和当天值得知道的事，填邮箱即订阅，随时一键退订</p>
        </div>
        <div className="sm-row">
          <div className="sm-row-title"><span className="sm-mark" />RSS</div>
          <button type="button" className="share-btn" onClick={copyRss}>
            {copied ? '已复制 ✓' : '复制 RSS 地址'}
          </button>
          <p className="sm-note">用 Feedly / Folo / Inoreader 订阅全文流</p>
        </div>
        <div className="sm-row">
          <div className="sm-row-title"><span className="sm-mark" />分享卡片</div>
          <p className="sm-note">每篇文章详情页可生成带二维码的报纸风海报，长按保存发朋友圈</p>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button type="button" className="nav-subscribe" onClick={() => setOpen(true)}>
        订阅
      </button>
      {typeof document !== 'undefined' && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
