// 编辑规则：信源分级、噪声预筛、入选门槛、热度。全部是纯函数，不碰数据库。
// 评分标准本身写在 prompts/editor.js；这里只决定「多少分算入选」和「怎么排」。
//
// 思路参考 AIHOT（github.com/KKKKhazix/AIHOT）：
//   - 信源分三级，官方一手门槛低、媒体门槛高：同一件事，官方原文更值得先看
//   - 热度按「事件」算而不是按文章算：48 小时内每个独立信源只计一次，24 小时减半

// ---- 信源分级 ----
// T1 官方一手（厂商 / 研究机构自己的博客）· T1_5 一线从业者专栏 · T2 媒体与社区
export const TIER_RANK = { T1: 0, T1_5: 1, T2: 2 };
export const TIER_LABEL = { T1: '官方', T1_5: '专栏', T2: '媒体' };

// ---- 入选门槛 ----
// 有模型评分时：评分 + 报道面加成 ≥ 该级门槛。数值沿用 AIHOT 的偏严口径，
// 换了评分提示词或模型后应拿自己标注的样本重新校准。
export const THRESHOLDS = { T1: 60, T1_5: 65, T2: 75 };
// 没有模型评分时（未配 ARK_API_KEY 或调用失败）的估分：只看信源级别和有多少人在说
export const FALLBACK_BASE = { T1: 66, T1_5: 64, T2: 58 };
export const FALLBACK_BAR = 64;

export function tierOf(tier) {
  return tier in TIER_RANK ? tier : 'T2';
}

// 报道面加成：每多一家独立信源 +4，封顶 +12
export function coverageBoost(sourceCount = 1) {
  return Math.min(12, 4 * Math.max(0, sourceCount - 1));
}

// 社区讨论加成（仅估分用）：HN 100 分 ≈ +5，400 分以上封顶 +10
function discussionBoost(extScore = 0) {
  return Math.min(10, Math.sqrt(Math.max(0, extScore)) / 2);
}

// 事件的综合分：有模型评分用评分，没有就估；都叠加报道面
export function effectiveScore({ score, tier, sourceCount = 1, extScore = 0 }) {
  const t = tierOf(tier);
  if (Number.isFinite(score)) return score + coverageBoost(sourceCount);
  // 估分的报道面权重更高：没有内容判断时，「几家都在报」是最可靠的信号
  return FALLBACK_BASE[t] + Math.min(18, 6 * Math.max(0, sourceCount - 1)) + discussionBoost(extScore);
}

export function isSelected({ score, tier, sourceCount = 1, extScore = 0, noise = '' }) {
  if (noise) return false;
  const eff = effectiveScore({ score, tier, sourceCount, extScore });
  return Number.isFinite(score) ? eff >= THRESHOLDS[tierOf(tier)] : eff >= FALLBACK_BAR;
}

// ---- 噪声预筛（机械规则，宽进：只拦明显不是「AI 行业新闻」的） ----
// 返回原因标签；空串 = 放行。被拦的条目仍在「全部」里，但不进精选、热点和日报。
const NOISE_RULES = [
  ['行情', /(美股|港股|A股|恒指|沪指|深成指|纳指|道指|标普|三大指数|恒生科技指数).{0,14}(收盘|收涨|收跌|开盘|休盘|午盘|涨|跌|新高|新低)/],
  ['行情', /目标价|涨停|跌停|子公司签署.{0,20}(合同|协议)|股东.{0,6}(减持|增持)|技术面角度/],
  ['活动', /(disrupt|startup battlefield|qcon|emtech|aie nyc|峰会|大会|博览会).{0,40}(门票|购票|通行证|报名|注册|优惠|折扣|倒计时|阵容|评审|评委|参展|议程)/i],
  ['活动', /(门票|购票|通行证|报名|倒计时).{0,40}(disrupt|qcon|emtech|峰会|大会)/i],
  ['活动', /[｜|]\s*QCon/i],
  ['活动', /\b(early[- ]bird|save \$?\d+|\d+% off|register now|tickets?)\b.{0,40}\b(disrupt|summit|conference)\b/i],
  ['合集', /^(早报|晚报|周报|午报)|^\[AINews\]|^The Download\b|^下载：|《?每日要闻》?|热门头条汇总|^Last Week in AI|一周(回顾|要闻|汇总)|周刊[（(#第]/i],
];
const PROMO = /限时(免费|优惠|特惠)|优惠码|立减|领券|现在(注册|购票)|最高可省|coupon|promo code|sponsored|赞助内容/i;

export function detectNoise(title = '', summary = '') {
  const t = String(title);
  for (const [label, re] of NOISE_RULES) if (re.test(t)) return label;
  // 摘要只用来识别推广：摘要里提到「大会」「指数」的正常新闻太多
  if (PROMO.test(t) || PROMO.test(String(summary))) return '推广';
  return '';
}

// ---- 热度 ----
const HEAT_WINDOW_H = 48;
const HEAT_HALF_LIFE_H = 24;

function decay(ageHours) {
  return ageHours >= HEAT_WINDOW_H ? 0 : Math.pow(0.5, Math.max(0, ageHours) / HEAT_HALF_LIFE_H);
}

// members: [{ source, created_at, ext_score }]
// 每个独立信源取它最早那篇的时间计一次；HN 讨论按分数折成「信源当量」（400 分 ≈ 1 家，封顶 1.5 家）：
// 讨论热闹算数，但一条只有 HN 在聊的事不该压过两家媒体都在报的事
export function eventHeat(members, now = Date.now()) {
  const firstSeen = new Map();
  let discussion = 0;
  for (const m of members) {
    const t = new Date(m.created_at).getTime();
    if (!firstSeen.has(m.source) || t < firstSeen.get(m.source)) firstSeen.set(m.source, t);
    if (m.ext_score > 0) {
      discussion = Math.max(discussion, Math.min(1.5, Math.sqrt(m.ext_score) / 20) * decay((now - t) / 3600000));
    }
  }
  let heat = discussion;
  for (const t of firstSeen.values()) heat += decay((now - t) / 3600000);
  return Math.round(heat * 1000) / 1000;
}

// 有没有能读的摘要：HN 条目只有「N 分 / N 条评论」，这种稿子不适合出面
export function hasSummary(post) {
  const s = String(post.summary_zh || post.summary || '');
  return s.length >= 20 && !s.startsWith('HN 热议') && s !== post.title;
}

// 事件代表稿：非噪声优先 → 信源级别高优先（官方一手出面）→ 有摘要的 → 评分高 → 发得早
export function pickRepresentative(members) {
  return [...members].sort((a, b) =>
    (a.noise ? 1 : 0) - (b.noise ? 1 : 0)
    || TIER_RANK[tierOf(a.tier)] - TIER_RANK[tierOf(b.tier)]
    || (hasSummary(b) ? 1 : 0) - (hasSummary(a) ? 1 : 0)
    || (b.score ?? -1) - (a.score ?? -1)
    || new Date(a.created_at) - new Date(b.created_at)
    || a.id - b.id
  )[0];
}
