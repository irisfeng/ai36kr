// 每日头条海报：取 24h 最受关注 Top1，渲染自包含报纸风海报 → public/daily-card.html
// 由 daily-digest.yml 每日 08:00（北京）调用并提交
import fs from 'node:fs';
import QRCode from 'qrcode';
import db from '../lib/db.js';
import { attachReactions } from '../lib/queries.js';

const SITE = 'https://aikr.shddai.net';

const rows = db.prepare(
  `SELECT p.*, (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
   FROM posts p WHERE p.created_at >= ? ORDER BY p.created_at DESC LIMIT 200`
).all(new Date(Date.now() - 24 * 3600000).toISOString());
const posts = attachReactions(rows);
const attention = (p) => (p.up - p.down) + Object.values(p.reactions || {}).reduce((a, b) => a + b, 0);
const top = [...posts].sort((a, b) => attention(b) - attention(a))[0];

if (!top) {
  console.log('24h 无内容，跳过海报生成');
  process.exit(0);
}

const title = top.title_zh || top.title;
const postUrl = `${SITE}/post/${top.id}`;
const date = new Date(Date.now() + 8 * 3600000);
const dateStr = `${date.getUTCFullYear()} 年 ${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日`;
const qr = await QRCode.toDataURL(postUrl, { width: 300, margin: 0, color: { dark: '#191813', light: '#00000000' } });
const cover = top.image_url
  ? `<div class="cover"><img src="${SITE}/api/img?u=${encodeURIComponent(top.image_url)}" alt=""/><span class="cat">${top.category}</span></div>`
  : `<div class="cover plain"><span class="cat">${top.category}</span></div>`;
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>今日头条 · ${esc(title)} · 听潮</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { min-height: 100vh; background: #EDEAE0; display: flex; align-items: center; justify-content: center; padding: 24px 12px; }
  .card {
    width: 390px; background: #F5F3ED; color: #191813; border: 1px solid #191813;
    padding: 20px 20px 16px; font-family: -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif;
  }
  .head { display: flex; align-items: center; gap: 10px; padding-bottom: 12px; border-bottom: 4px double #191813; }
  .seal { width: 34px; height: 34px; background: #C23B22; color: #FCFBF7; font-family: 'Songti SC','Noto Serif SC',serif; font-weight: 900; font-size: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .brand { font-family: 'Songti SC','Noto Serif SC',serif; font-weight: 900; font-size: 22px; letter-spacing: 2px; line-height: 1.15; }
  .wire { font-family: Menlo, monospace; font-size: 7.5px; letter-spacing: 2.5px; color: #8B8574; }
  .date { margin-left: auto; font-family: Menlo, monospace; font-size: 9.5px; color: #8B8574; }
  .cover { position: relative; margin-top: 14px; aspect-ratio: 21/9; overflow: hidden; background: linear-gradient(150deg,#2B2615,#161307); }
  .cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cover.plain::before { content: 'AI'; position: absolute; right: 10px; top: 6px; font-family: 'Songti SC',serif; font-size: 52px; font-weight: 900; color: rgba(252,251,247,0.13); }
  .cat { position: absolute; left: 10px; bottom: 10px; background: rgba(25,24,19,0.6); color: #FCFBF7; font-family: 'Songti SC',serif; font-weight: 900; font-size: 13px; padding: 2px 8px; }
  .body { padding: 14px 2px 12px; }
  h1 { font-family: 'Songti SC','Noto Serif SC',serif; font-weight: 900; font-size: 21px; line-height: 1.45; }
  .orig { font-size: 11px; color: #8B8574; margin-top: 5px; line-height: 1.5; }
  .summary { font-size: 12.5px; color: #4B463A; line-height: 1.75; margin-top: 10px; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .meta { font-family: Menlo, monospace; font-size: 10px; color: #8B8574; margin-top: 10px; }
  .foot { display: flex; align-items: center; gap: 12px; border-top: 1px solid #191813; padding-top: 12px; }
  .qr { width: 64px; height: 64px; }
  .foot-text b { font-family: 'Songti SC',serif; font-size: 14px; display: block; }
  .foot-text span { font-family: Menlo, monospace; font-size: 9.5px; color: #8B8574; }
  .hint { text-align: center; font-size: 12px; color: #8B8574; margin-top: 16px; }
</style></head><body>
<div>
  <div class="card">
    <div class="head">
      <span class="seal">听</span>
      <div class="brand">听潮<div class="wire">AI NEWS WIRE</div></div>
      <span class="date">${dateStr}</span>
    </div>
    ${cover}
    <div class="body">
      <h1>${esc(title)}</h1>
      ${top.title_zh ? `<p class="orig">${esc(top.title)}</p>` : ''}
      <p class="summary">${esc(top.summary_zh || top.summary)}</p>
      <p class="meta">${esc(top.source)} · ${esc(top.category)} · ▲${top.up - top.down}</p>
    </div>
    <div class="foot">
      <img class="qr" src="${qr}" alt="二维码"/>
      <div class="foot-text"><b>扫码阅读原文</b><span>听潮 TideWire · aikr.shddai.net</span></div>
    </div>
  </div>
  <p class="hint">长按或截图分享今日头条 · 更多见 <a style="color:#C23B22" href="${SITE}/daily">今日一页</a></p>
</div>
</body></html>`;

fs.writeFileSync('public/daily-card.html', html);
console.log(`海报已生成：${title.slice(0, 40)}（${top.source}）`);
