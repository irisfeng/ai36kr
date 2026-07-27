// 封面占位：纸面活字排版（无图时的默认形态）——浅纸底 + 分类首字水印，
// 替代原先的墨黑渐变块。页面唯一强调色仍是朱砂报红，封面不做深色块。
export const CATEGORY_STYLES = {
  '大模型':   { bg: 'linear-gradient(150deg, #EDEAE0 0%, #E4E0D2 100%)', ink: '#3A362C' },
  'Agent':    { bg: 'linear-gradient(150deg, #E7EAEC 0%, #DDE2E6 100%)', ink: '#333B44' },
  '具身智能': { bg: 'linear-gradient(150deg, #E5EAE5 0%, #DAE2DC 100%)', ink: '#2F3D33' },
  'AI创投':   { bg: 'linear-gradient(150deg, #EEE7DA 0%, #E6DCC8 100%)', ink: '#453A28' },
  '芯片算力': { bg: 'linear-gradient(150deg, #E8E8EB 0%, #DDDDDE 100%)', ink: '#36363E' },
  '政策监管': { bg: 'linear-gradient(150deg, #EDE3DE 0%, #E4D6CE 100%)', ink: '#463029' },
  '开源社区': { bg: 'linear-gradient(150deg, #EBE9D9 0%, #E1DEC6 100%)', ink: '#403D28' },
  '社区投稿': { bg: 'linear-gradient(150deg, #EDEAE0 0%, #E4E0D2 100%)', ink: '#3A362C' },
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
  return style.bg;
}

// 分类首字水印的墨色（10% 透明度下与纸底同族不刺眼）
export function coverInk(post) {
  const style = CATEGORY_STYLES[post.category] || CATEGORY_STYLES['社区投稿'];
  return style.ink;
}
