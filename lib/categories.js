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

export function coverFor(post) {
  const style = CATEGORY_STYLES[post.category] || CATEGORY_STYLES['社区投稿'];
  return style.bg;
}

// 分类首字水印的墨色（10% 透明度下与纸底同族不刺眼）
export function coverInk(post) {
  const style = CATEGORY_STYLES[post.category] || CATEGORY_STYLES['社区投稿'];
  return style.ink;
}
