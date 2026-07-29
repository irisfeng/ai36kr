// 生成式封面 v2：以文章 id 为种子的「潮汐」波纹画（SVG）
// 三种构图家族（浪涌/悬潮/环月）+ 分类专属浪色 + 纸纹颗粒，杜绝"一张脸"
import { CATEGORY_STYLES } from './categories.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function paperColors(category) {
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES['社区投稿'];
  const hexes = style.bg.match(/#[0-9A-Fa-f]{6}/g) || ['#EDEAE0', '#E4E0D2'];
  return { top: hexes[0], bottom: hexes[1] || hexes[0], ink: style.ink };
}

function wavePath(rand, { width, baseY, amp, freq, phase, closeY }) {
  const pts = [];
  const steps = 48;
  const f2 = freq * (1.7 + rand() * 0.8);
  const p2 = rand() * Math.PI * 2;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const y = baseY
      + Math.sin((i / steps) * Math.PI * 2 * freq + phase) * amp
      + Math.sin((i / steps) * Math.PI * 2 * f2 + p2) * amp * 0.35;
    pts.push([x, y]);
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i][0] + pts[i + 1][0]) / 2;
    const yc = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${xc.toFixed(1)} ${yc.toFixed(1)}`;
  }
  if (closeY !== null && closeY !== undefined) {
    d += ` L ${width} ${closeY} L 0 ${closeY} Z`;
  }
  return d;
}

// 朱砂用法：只勾线不铺面（占画面 ~5% 的点睛，而不是 50% 的主色）
function redLine(rand, opts) {
  return `<path d="${wavePath(rand, { ...opts, closeY: null })}" fill="none" stroke="${rgba('#C23B22', 0.85)}" stroke-width="7"/>`;
}

function grain(rand, W, H, ink) {
  let dots = '';
  for (let i = 0; i < 26; i++) {
    dots += `<circle cx="${(rand() * W).toFixed(0)}" cy="${(rand() * H).toFixed(0)}" r="${(0.6 + rand() * 1.1).toFixed(1)}" fill="${rgba(ink, 0.05 + rand() * 0.05)}"/>`;
  }
  return dots;
}

// 构图一：浪涌（经典款，底部层浪 + 一道朱砂勾线）
function composeSurge(rand, W, H, ink) {
  const layers = 4 + Math.floor(rand() * 2);
  let waves = '';
  let lastCurve = null;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const opts = {
      width: W, baseY: H * (0.42 + t * 0.5),
      amp: 6 + rand() * 10, freq: 1.2 + rand() * 1.6, phase: rand() * Math.PI * 2, closeY: H,
    };
    waves += `<path d="${wavePath(rand, opts)}" fill="${rgba(ink, 0.10 + t * 0.22)}"/>`;
    if (i === layers - 1) lastCurve = opts;
  }
  waves += redLine(rand, lastCurve);
  return waves;
}

// 构图二：悬潮（浪潮从顶部垂落，底部大留白 + 朱砂收边）
function composeOverhang(rand, W, H, ink) {
  const layers = 3 + Math.floor(rand() * 2);
  let waves = '';
  let lastCurve = null;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const opts = {
      width: W, baseY: H * (0.16 + t * 0.4),
      amp: 5 + rand() * 9, freq: 1.1 + rand() * 1.4, phase: rand() * Math.PI * 2, closeY: 0,
    };
    waves += `<path d="${wavePath(rand, opts)}" fill="${rgba(ink, 0.10 + t * 0.18)}"/>`;
    if (i === layers - 1) lastCurve = opts;
  }
  waves += redLine(rand, lastCurve);
  waves += `<rect x="0" y="${H - 6}" width="${W}" height="3" fill="${rgba('#C23B22', 0.8)}"/>`;
  return waves;
}

// 构图三：环月（以日月为圆心的同心弧）
function composeRings(rand, W, H, ink, sunX, sunY) {
  const rings = 4 + Math.floor(rand() * 3);
  const redAt = 1 + Math.floor(rand() * (rings - 1));
  let out = '';
  for (let i = rings; i >= 1; i--) {
    const r = 34 + i * (20 + rand() * 8);
    out += i === redAt
      ? `<circle cx="${sunX}" cy="${sunY}" r="${r.toFixed(0)}" fill="none" stroke="${rgba('#C23B22', 0.7)}" stroke-width="7"/>`
      : `<circle cx="${sunX}" cy="${sunY}" r="${r.toFixed(0)}" fill="none" stroke="${rgba(ink, 0.10 + (rings - i) * 0.05)}" stroke-width="${(8 + rand() * 6).toFixed(0)}"/>`;
  }
  // 地平线
  const hy = H * (0.66 + rand() * 0.12);
  out += `<rect x="0" y="${hy.toFixed(0)}" width="${W}" height="${H - hy}" fill="${rgba(ink, 0.14)}"/>`;
  return out;
}

export function tideCoverSvg(post) {
  const rand = mulberry32((Number(post.id) * 2654435761) % 4294967296);
  const W = 420, H = 180;
  const { top, bottom, ink } = paperColors(post.category);

  const sunR = 15 + rand() * 13;
  const sunX = W * (0.18 + rand() * 0.64);
  const sunY = H * (0.2 + rand() * 0.22);
  const sunIsRed = rand() > 0.7;
  const sun = `<circle cx="${sunX.toFixed(0)}" cy="${sunY.toFixed(0)}" r="${sunR.toFixed(0)}" fill="${sunIsRed ? rgba('#C23B22', 0.85) : rgba(ink, 0.16)}"/>`;
  const moon = sunIsRed ? '' : `<circle cx="${(sunX - sunR * 0.35).toFixed(0)}" cy="${(sunY - sunR * 0.2).toFixed(0)}" r="${(sunR * 0.8).toFixed(0)}" fill="${rgba(top, 0.9)}"/>`;

  const families = [composeSurge, composeOverhang, composeRings];
  const family = families[Math.floor(rand() * families.length)];
  const body = family === composeRings
    ? family(rand, W, H, ink, sunX.toFixed(0), sunY.toFixed(0))
    : family(rand, W, H, ink);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${grain(rand, W, H, ink)}
  ${sun}${moon}
  ${body}
</svg>`;
}
