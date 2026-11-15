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
  // 线上漏掉过的几种合集写法：【钛晨报】【数智周报】、8点1氪、「Edge AI Daily 早报（10月3日）」、SuperTechFans 的 HN 每日汇总
  ['合集', /【[^】]{0,6}(晨报|早报|晚报|午报|周报)】|^8点1氪|(晨报|早报|晚报)[（(]|Hacker News\s*热门(头条|内容)/i],
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
export const HEAT_WINDOW_H = 48;
export const HEAT_HALF_LIFE_H = 24;
export const DISCUSSION_CAP = 1.5;

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
      discussion = Math.max(discussion, Math.min(DISCUSSION_CAP, Math.sqrt(m.ext_score) / 20) * decay((now - t) / 3600000));
    }
  }
  let heat = discussion;
  for (const t of firstSeen.values()) heat += decay((now - t) / 3600000);
  return Math.round(heat * 1000) / 1000;
}

// 有没有能读的摘要：HN 条目只有「N 分 / N 条评论」，这种稿子不适合出面
export function hasSummary(post) {
  return usableSummary(post).length > 0;
}

export function usableSummary(post) {
  const s = String(post?.summary_zh || post?.summary || '');
  if (s.length < 20 || s.startsWith('HN 热议') || s === post?.title || s === post?.title_zh) return '';
  return s;
}

// 编辑标准：材料短到无法确认对象和动作时，不高于这个分。这种稿子不拿来当门面。
export const UNCLEAR_SCORE = 30;

const SUBJECT_PARTICLE = /[的了是在不与和或及将已被把对为从向以而但就也都还很最更这那其个中上下后前内外称未没正并于到让给所]/;
const SHORT_ORG = new Set(['谷歌', '苹果', '微软', '百度', '腾讯', '华为', '阿里', '字节']);

// 摘要第一句能不能脱离标题回答「谁做了什么」：要出现标题里的主体。
// 标着低分的稿子，编辑已经判定材料说不清对象和动作。
export function statesWhoDidWhat(post) {
  const summary = usableSummary(post);
  if (!summary) return false;
  if (Number.isFinite(post.score) && post.score <= UNCLEAR_SCORE) return false;
  const sentence = summary.split(/[。！？!?]/)[0] || summary;
  return sentenceNamesSubject(sentence, post);
}

function sentenceNamesSubject(sentence, post) {
  const title = `${post.title || ''} ${post.title_zh || ''}`;
  const s = sentence.toLowerCase();
  const tl = title.toLowerCase();
  if ((/jensen/.test(tl) || title.includes('黄仁勋')) && (/jensen/.test(s) || sentence.includes('黄仁勋'))) return true;
  if ((/nvidia/.test(tl) || title.includes('英伟达')) && (/nvidia/.test(s) || sentence.includes('英伟达'))) return true;
  if ((/kress/.test(tl) || title.includes('克雷斯')) && (/kress/.test(s) || sentence.includes('克雷斯'))) return true;
  for (const w of tl.match(/[a-z][a-z0-9-]{3,}/g) || []) {
    if (['the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'will', 'about', 'after', 'techcrunch'].includes(w)) continue;
    if (s.includes(w)) return true;
  }
  for (const seg of title.match(/[㐀-䶿一-鿿]{2,}/g) || []) {
    if (SHORT_ORG.has(seg) && sentence.includes(seg)) return true;
    if (seg.length < 3) continue;
    for (let i = 0; i < seg.length - 2; i++) {
      const g = seg.slice(i, i + 3);
      if (SUBJECT_PARTICLE.test(g)) continue;
      if (sentence.includes(g)) return true;
    }
  }
  return false;
}

function clarityRank(post) {
  if (statesWhoDidWhat(post)) return 2;
  if (usableSummary(post)) return 1;
  return 0;
}

// 事件代表稿：「谁做了什么」说得最清楚的那篇。
// 说得一样清楚时官方一手优先；都说不清时也让官方一手出面，而不是低分专栏。
export function pickRepresentative(members) {
  return [...members].sort((a, b) =>
    (a.noise ? 1 : 0) - (b.noise ? 1 : 0)
    || clarityRank(b) - clarityRank(a)
    || (tierOf(a.tier) === 'T1' ? 0 : 1) - (tierOf(b.tier) === 'T1' ? 0 : 1)
    || (b.score ?? -1) - (a.score ?? -1)
    || new Date(a.created_at) - new Date(b.created_at)
    || a.id - b.id
  )[0];
}

// 页面上的分数：代表稿展示这件事入选用的那个分数（成员里的最高分），不是代表稿自己的分。
export function shownScore(post) {
  if (!post) return null;
  if ((post.rep === 1 || post.rep === true) && Number.isFinite(post.event_score)) return post.event_score;
  return Number.isFinite(post.score) ? post.score : null;
}

// ---- 评分封顶（与 prompts/editor.js 的刻度同一套，写在模型分数落地之前） ----
// 模型经常不守刻度。这里按材料本身封顶，不改 THRESHOLDS。
const GENERIC_NAME = new Set(['app', 'api', 'llm', 'rag', 'mcp', 'the', 'and', 'for', 'how', 'now', 'new', 'ai', 'its', 'with', 'from', 'this', 'that', 'hn']);
const ACTION = '发布|推出|宣布|开放|上线|收购|卸任|辞职|开源|接入|集成|解散|登陆|召回|起诉|证实|确认|回应|签署|传唤|要求|调查|罚款|裁员|关停|下架';
const NEWS_VERB = new RegExp(`${ACTION}|ships|shipped|launches|launched|releases|released|announces|announced|acquires|acquired|unveils|resigns|now in|now available`, 'i');
const CJK_ACTOR = new RegExp(`[㐀-䶿一-鿿]{2,8}(?:今日|昨天|当地时间)?(?:正式)?(?:${ACTION})`);

function summaryConfirms(summary) {
  const text = String(summary || '');
  const names = text.match(/\b[A-Z][A-Za-z0-9.+-]{1,}\b/g) || [];
  const named = names.some((word) => word.length >= 3 && !GENERIC_NAME.has(word.toLowerCase()))
    || CJK_ACTOR.test(text);
  const fact = NEWS_VERB.test(text) || /\d/.test(text);
  return named && fact;
}

// RSS 摘要短到无法确认对象和动作。没传入摘要（undefined）时不猜。
export function materialTooThin(summary) {
  if (summary == null) return false;
  const text = String(summary).replace(/\s+/g, ' ').trim();
  if (!text || /^HN 热议/.test(text) || /点击查看原文/.test(text)) return true;
  if (summaryConfirms(text)) return false;
  return text.length < 80;
}

// 只说「现已登陆某模型」、例行上架、只接入另一个模型：不高于 45
export function isRoutineListing(title = '', summary = '') {
  const blob = `${title}\n${summary}`;
  const listing = /现已(登陆|上线|支持|接入|集成)|已登陆/.test(blob)
    || /\bnow (available|live|in|on)\b/i.test(blob)
    || /接入[^。\n]{0,16}(模型|GPT|Claude|Gemini|Llama|Kimi|DeepSeek|GLM)/.test(blob);
  if (!listing) return false;
  return !/发布|推出|开源|宣布|\b(launch|releas|ship|announc)\w*/i.test(title);
}

function hasTransferableMethod(text) {
  return /成本|节省|下降了?\s*\d|提升了?\s*\d|准确率|基准|benchmark|步骤|配方|可复用/i.test(text);
}

// 客户案例没有任务、规模、成本或可迁移的方法：不高于 50。厂商写自己的发布不算。
export function isCustomerCase(title = '', summary = '', source = '') {
  const blob = `${title}\n${summary}`;
  const how = String(title).match(/^how\s+([A-Z][\w.+-]*)\s+(ships|uses|builds|scales|runs|adopts|improves)\b/i);
  const labeled = /customer (story|spotlight)|case study|客户案例|成功案例/i.test(blob);
  if (!how && !labeled) return false;
  if (how) {
    const who = how[1].toLowerCase();
    const src = String(source).toLowerCase();
    if (src && (src.includes(who) || who.includes(src))) return false;
  }
  return !hasTransferableMethod(blob);
}

export function scoreCeiling(score, title = '', summary = '', source = '') {
  if (!Number.isFinite(score)) return score ?? null;
  let cap = 100;
  if (materialTooThin(summary)) cap = Math.min(cap, UNCLEAR_SCORE);
  if (isRoutineListing(title, summary)) cap = Math.min(cap, 45);
  if (isCustomerCase(title, summary, source)) cap = Math.min(cap, 50);
  return Math.min(score, cap);
}

// 「突发」「炸了」「重磅」不是新事实。去掉之后主体和动作还在。
export function stripHypeTitle(title = '') {
  const raw = String(title || '').trim();
  if (!raw) return raw;
  const next = raw
    .replace(/突发(?!事件)[!！：:\s]*/g, '')
    .replace(/炸了[!！？?\s]*/g, '')
    .replace(/重磅[!！：:\s]*/g, '')
    .replace(/^[，,、\s|｜:：-]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return next || raw;
}

export function displayTitle(post) {
  if (!post) return '';
  return stripHypeTitle(post.title_zh || post.title || '');
}

// 这件事现在的状态：比代表稿更晚、说得清的那一则。没有更新就不用另起一行。
export function latestDevelopment(post, others = []) {
  const mine = usableSummary(post);
  const later = (others || [])
    .filter((item) => item && item.id !== post.id && usableSummary(item)
      && new Date(item.created_at) > new Date(post.created_at))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);
  const picked = later.find((item) => statesWhoDidWhat(item)) || later[0];
  if (!picked) return null;
  const summary = usableSummary(picked);
  if (!summary || summary === mine) return null;
  return {
    id: picked.id,
    source: picked.source,
    created_at: picked.created_at,
    summary,
    title: displayTitle(picked),
  };
}
