// 生成式封面：以文章 id 为种子的「潮汐」波纹画（SVG）
// 纸底 + 多层墨色海浪 + 一道朱砂浪 + 一轮落霞——听潮的品牌基因画进每张封面
import { CATEGORY_STYLES } from './categories.js';

// 确定性 PRNG：同一 id 永远生成同一张画
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

// 从 CATEGORY_STYLES 的渐变里取两个纸色
function paperColors(category) {
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES['社区投稿'];
  const hexes = style.bg.match(/#[0-9A-Fa-f]{6}/g) || ['#EDEAE0', '#E4E0D2'];
  return { top: hexes[0], bottom: hexes[1] || hexes[0], ink: style.ink };
}

// 单层海浪：多个正弦分量叠加的光滑曲线，向底部闭合
function wavePath(rand, { width, height, baseY, amp, freq, phase, closeY }) {
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
  d += ` L ${width} ${closeY} L 0 ${closeY} Z`;
  return d;
}

export function tideCoverSvg(post) {
  const rand = mulberry32(Number(post.id) * 2654435761 % 4294967296);
  const W = 420, H = 180;
  const { top, bottom, ink } = paperColors(post.category);

  // 落霞圆盘（焦点）：位置/大小/是否朱砂由种子决定
  const sunR = 16 + rand() * 14;
  const sunX = W * (0.2 + rand() * 0.6);
  const sunY = H * (0.22 + rand() * 0.2);
  const sunIsRed = rand() > 0.7;
  const sun = `<circle cx="${sunX.toFixed(0)}" cy="${sunY.toFixed(0)}" r="${sunR.toFixed(0)}" fill="${sunIsRed ? rgba('#C23B22', 0.85) : rgba(ink, 0.16)}"/>`;
  // 内切小圆（纸色），形成「月相」细节
  const moon = sunIsRed ? '' : `<circle cx="${(sunX - sunR * 0.35).toFixed(0)}" cy="${(sunY - sunR * 0.2).toFixed(0)}" r="${(sunR * 0.8).toFixed(0)}" fill="${rgba(top, 0.9)}"/>`;

  // 4-5 层海浪：越远越浅，朱砂浪藏在其中一层
  const layers = 4 + Math.floor(rand() * 2);
  const redAt = 1 + Math.floor(rand() * (layers - 1));
  let waves = '';
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1); // 0=远 1=近
    const baseY = H * (0.42 + t * 0.5);
    const amp = 6 + rand() * 10;
    const freq = 1.2 + rand() * 1.6;
    const phase = rand() * Math.PI * 2;
    const d = wavePath(rand, { width: W, height: H, baseY, amp, freq, phase, closeY: H });
    if (i === redAt) {
      waves += `<path d="${d}" fill="${rgba('#C23B22', 0.78)}"/>`;
    } else {
      waves += `<path d="${d}" fill="${rgba(ink, 0.07 + t * 0.16)}"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${sun}${moon}
  ${waves}
</svg>`;
}
