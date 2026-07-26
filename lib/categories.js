// 编辑风封面：统一墨色系双色调（duotone ink），分类之间仅用色相微差区分。
// 页面唯一强调色是朱砂报红（globals.css --red），封面不做彩虹渐变。
export const CATEGORY_STYLES = {
  '大模型':   { gradient: 'linear-gradient(150deg, #262420 0%, #14130F 100%)' },
  'Agent':    { gradient: 'linear-gradient(150deg, #1F2530 0%, #11141B 100%)' },
  '具身智能': { gradient: 'linear-gradient(150deg, #1D2B24 0%, #0F1713 100%)' },
  'AI创投':   { gradient: 'linear-gradient(150deg, #2E2218 0%, #191007 100%)' },
  '芯片算力': { gradient: 'linear-gradient(150deg, #26262B 0%, #131316 100%)' },
  '政策监管': { gradient: 'linear-gradient(150deg, #2E1C16 0%, #180D0A 100%)' },
  '开源社区': { gradient: 'linear-gradient(150deg, #2B2615 0%, #161307 100%)' },
  '社区投稿': { gradient: 'linear-gradient(150deg, #262420 0%, #14130F 100%)' },
};

export const CATEGORIES = ['大模型', 'Agent', '具身智能', 'AI创投', '芯片算力', '政策监管', '开源社区'];

export const PRODUCT_CATEGORIES = ['开发工具', '效率办公', '内容创作', '语音音频', '图像视频', 'Agent应用'];

const PRODUCT_PALETTE = [
  ['#262420', '#14130F'], ['#1F2530', '#11141B'], ['#1D2B24', '#0F1713'],
  ['#2E2218', '#191007'], ['#2E1C16', '#180D0A'], ['#2B2615', '#161307'],
  ['#26262B', '#131316'], ['#1B2A30', '#0E161A'], ['#2A1E2B', '#150F16'],
  ['#33302A', '#1A1913'],
];

export function productGradient(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) % 997;
  const [a, b] = PRODUCT_PALETTE[h % PRODUCT_PALETTE.length];
  return `linear-gradient(150deg, ${a} 0%, ${b} 100%)`;
}

export function coverFor(post) {
  const style = CATEGORY_STYLES[post.category] || CATEGORY_STYLES['社区投稿'];
  return style.gradient;
}
