// 分享海报：服务端直接生成 SVG（替代 html2canvas 客户端截图——后者在移动端会卡死）
// 自包含：真实封面图以 base64 内嵌（走 SSRF 防护抓取），无图则用潮汐画
import QRCode from 'qrcode';
import db from '@/lib/db';
import { tideCoverSvg } from '@/lib/tide-cover';
import { fetchPublicImage } from '@/lib/safe-image';
import { dateGroup } from '@/lib/time';

export const dynamic = 'force-dynamic';

const SITE = 'https://aikr.shddai.net';
const W = 780, PAD = 40;

function esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 折行：CJK 按字、ASCII 按词（不在单词中间断行）；粗算字宽中文 1em、ASCII 0.56em
function wrap(text, fontSize, maxWidth) {
  const tokens = [];
  for (const m of String(text || '').matchAll(/[A-Za-z0-9$@#%&+._~/-]+|\s+|[^A-Za-z0-9\s]/g)) {
    const t = m[0];
    if (/^\s+$/.test(t)) tokens.push({ t: ' ', w: fontSize * 0.3 });
    else if (/^[A-Za-z0-9]/.test(t)) tokens.push({ t, w: t.length * fontSize * 0.56 });
    else tokens.push({ t, w: fontSize });
  }
  const lines = [];
  let line = '', w = 0;
  for (const tk of tokens) {
    if (w + tk.w > maxWidth && line.trim()) {
      lines.push(line.trimEnd());
      line = tk.t === ' ' ? '' : tk.t;
      w = line ? tk.w : 0;
    } else {
      line += tk.t;
      w += tk.w;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

async function coverBlock(post, x, y, w, h) {
  // 优先真实封面：SSR 端抓取内嵌 base64；失败回退潮汐画
  if (post.image_url) {
    try {
      const img = await fetchPublicImage(post.image_url, { maxBytes: 3 * 1024 * 1024 });
      const dataUri = `data:${img.contentType};base64,${img.body.toString('base64')}`;
      return `
        <clipPath id="coverClip"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>
        <g clip-path="url(#coverClip)">
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#2B2615"/>
          <image href="${dataUri}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>
        </g>`;
    } catch { /* 回退潮汐画 */ }
  }
  // 潮汐画内嵌（独立 svg 转 group：取其内部元素）
  const inner = tideCoverSvg(post).replace(/^[\s\S]*?<rect width/, '<rect width').replace(/<\/svg>\s*$/, '');
  const scaleX = w / 420, scaleY = h / 180;
  return `<g transform="translate(${x},${y}) scale(${Math.max(scaleX, scaleY)}) translate(${Math.min(0, (w / Math.max(scaleX, scaleY) - 420) / 2)},0)">
    ${inner.replace('viewBox', 'data-vb')}
  </g>`;
}

export async function GET(request, ctx) {
  const params = await ctx.params; // 兼容 sync/async params（Vercel 构建器差异）
  const id = Number(String(params.id).replace(/\.svg$/i, ''));
  if (!Number.isInteger(id) || id <= 0) {
    return new Response(`bad id: raw=${String(params.id)}`, { status: 400 });
  }
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  if (!post) return new Response('not found', { status: 404 });

  const title = post.title_zh || post.title;
  const summary = post.summary_zh || post.summary || '';
  const dateStr = dateGroup(post.created_at); // 海报日期统一 UTC+8
  const qr = await QRCode.toDataURL(`${SITE}/post/${post.id}`, { width: 300, margin: 0, color: { dark: '#191813', light: '#00000000' } });

  const coverW = W - PAD * 2, coverH = Math.round(coverW * 9 / 21);
  // 折行预留 6% 安全边（不同平台字体宽度有差异），文字区加裁剪防溢出
  const textW = (W - PAD * 2) * 0.9;
  const titleLines = wrap(title, 44, textW).slice(0, 3);
  // 英文原题：超长按词边界截断，单行展示（避免折行估算截断单词）
  const origText = post.title_zh
    ? (post.title.length > 72 ? post.title.slice(0, 70).replace(/[\s,;:.-]+[^\s,;:.-]*$/, '') + '…' : post.title)
    : '';
  // 摘要折行去掉行首标点（，。、；：等不该出现在行首）
  const summaryLines = wrap(summary, 24, textW)
    .map((l) => l.replace(/^[，。、；：！？）】」』\s]+/, ''))
    .slice(0, 4);

  let y = 0;
  const parts = [];
  // 刊头
  const headH = 118;
  parts.push(`
  <rect x="0" y="0" width="${W}" height="${headH}" fill="#F5F3ED"/>
  <rect x="${PAD}" y="34" width="50" height="50" fill="#C23B22"/>
  <text x="${PAD + 25}" y="70" text-anchor="middle" font-family="'Songti SC','Noto Serif SC',serif" font-weight="900" font-size="30" fill="#FCFBF7">听</text>
  <text x="${PAD + 64}" y="64" font-family="'Songti SC','Noto Serif SC',serif" font-weight="900" font-size="36" letter-spacing="3" fill="#191813">听潮</text>
  <text x="${PAD + 64}" y="84" font-family="Menlo,monospace" font-size="11" letter-spacing="4" fill="#8B8574">AI NEWS WIRE</text>
  <text x="${W - PAD}" y="64" text-anchor="end" font-family="Menlo,monospace" font-size="15" fill="#8B8574">${dateStr}</text>
  <line x1="${PAD}" y1="${headH - 14}" x2="${W - PAD}" y2="${headH - 14}" stroke="#191813" stroke-width="1.5"/>
  <line x1="${PAD}" y1="${headH - 9}" x2="${W - PAD}" y2="${headH - 9}" stroke="#191813" stroke-width="4"/>`);
  y = headH + 24;

  // 封面
  parts.push(await coverBlock(post, PAD, y, coverW, coverH));
  parts.push(`<rect x="${PAD}" y="${y + coverH - 34}" width="${post.category.length * 18 + 20}" height="34" fill="rgba(25,24,19,0.62)"/>
  <text x="${PAD + 10}" y="${y + coverH - 11}" font-family="'Songti SC','Noto Serif SC',serif" font-weight="900" font-size="19" fill="#FCFBF7">${esc(post.category)}</text>`);
  y += coverH + 30;

  // 标题/原文/摘要（折行已预留 6% 安全边，兼容跨平台字宽差异）
  for (const l of titleLines) {
    parts.push(`<text x="${PAD}" y="${y + 18}" font-family="'Songti SC','Noto Serif SC',serif" font-weight="900" font-size="44" fill="#191813">${esc(l)}</text>`);
    y += 60;
  }
  y += 4;
  if (origText) {
    parts.push(`<text x="${PAD}" y="${y + 8}" font-family="-apple-system,'PingFang SC',sans-serif" font-size="20" fill="#8B8574">${esc(origText)}</text>`);
    y += 30;
  }
  y += 8;
  for (const l of summaryLines) {
    parts.push(`<text x="${PAD}" y="${y + 10}" font-family="-apple-system,'PingFang SC',sans-serif" font-size="24" fill="#4B463A">${esc(l)}</text>`);
    y += 40;
  }
  parts.push(`<text x="${PAD}" y="${y + 16}" font-family="Menlo,monospace" font-size="16" fill="#8B8574">${esc(post.source)} · ${esc(post.category)}</text>`);
  y += 40;

  // 底部二维码区
  const footH = 128;
  parts.push(`
  <line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="#191813" stroke-width="1.2"/>
  <image href="${qr}" x="${PAD}" y="${y + 16}" width="96" height="96"/>
  <text x="${PAD + 116}" y="${y + 52}" font-family="'Songti SC','Noto Serif SC',serif" font-weight="900" font-size="24" fill="#191813">扫码阅读原文</text>
  <text x="${PAD + 116}" y="${y + 82}" font-family="Menlo,monospace" font-size="15" fill="#8B8574">听潮 TideWire · aikr.shddai.net</text>`);
  y += footH;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}">
  <rect width="${W}" height="${y}" fill="#F5F3ED"/>
  <rect x="6" y="6" width="${W - 12}" height="${y - 12}" fill="none" stroke="#191813" stroke-width="1.5"/>
  ${parts.join('\n')}
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      // 纵深防御：海报以文档形式打开（新窗口查看原图）时禁止任何脚本执行
      'Content-Security-Policy': "script-src 'none'",
    },
  });
}
