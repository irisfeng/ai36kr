// 事件聚簇：不同信源报道的同一件事归成一个事件，读者只看到一次。
// 原先的做法是「相似就丢弃后到者」——去了重，也丢掉了「有几家在报」这个最有用的信号。
//
// 没有向量服务，用标题文字重合度：在中文展示标题（title_zh || title）上取
// 中文二元组 + 英文词 + 数字，按 IDF 加权（「正式发布」「全新」这类词不值钱，
// 「Akamai」「116」值钱）。判同规则偏保守：错并会藏掉一条新闻，漏并只是多显示一条。
//
// 还在发展的事件另走一条，不靠把上面的阈值调松：核心事实出现之后，后续角度
// （请愿、政府回应、继任者、融资影响）挂到同一条上。只共享「英伟达」这种名字、
// 说的却是另一件事（芯片追踪法案、另一款芯片）的，仍然分开。

export const EVENT_WINDOW_MS = 72 * 3600 * 1000;

// 标题分词：英文取去停用词后的单词，中文取连续段的二元组（bigram）
const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'had', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'way', 'who', 'did', 'let', 'say', 'she', 'too', 'use', 'with', 'from', 'that', 'this', 'what', 'when', 'will', 'over', 'after', 'before', 'into', 'about', 'against', 'between', 'through', 'during', 'under', 'while', 'could', 'would', 'should', 'than', 'then', 'them', 'they', 'their', 'there', 'these', 'those', 'been', 'have', 'were', 'being', 'does', 'doing', 'down', 'off', 'per', 'via',
]);

export function titleTokens(title = '') {
  const tokens = new Set();
  const lower = String(title).toLowerCase();
  // 英文单词（长度>2 且非停用词）
  for (const w of lower.match(/[a-z][a-z0-9-]{2,}/g) || []) {
    if (!STOPWORDS.has(w)) tokens.add(w);
  }
  // 中文连续段的二元组
  for (const seg of title.match(/[㐀-䶿一-鿿]{2,}/g) || []) {
    for (let i = 0; i < seg.length - 1; i++) tokens.add(seg.slice(i, i + 2));
  }
  return tokens;
}

// 英文但不构成「实体」的高频词：共享它们不说明是同一件事
const GENERIC = new Set(['agent', 'agents', 'llm', 'api', 'show', 'ceo', 'cto', 'gpu', 'app', 'aigc', 'the', 'new', 'model', 'models']);

// 标题签名：tokens 用于算相似度，anchors 是其中的实体类 token（英文专名、两位以上数字）
export function eventSignature(title = '') {
  const tokens = titleTokens(title);
  const anchors = new Set();
  for (const w of String(title).toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []) {
    if (!GENERIC.has(w)) anchors.add(w);
  }
  for (const n of String(title).match(/\d+(?:\.\d+)?/g) || []) {
    if (n.length >= 2) { tokens.add(`#${n}`); anchors.add(`#${n}`); }
  }
  return { tokens, anchors };
}

export function buildIdf(signatures) {
  const df = new Map();
  for (const s of signatures) for (const k of s.tokens) df.set(k, (df.get(k) || 0) + 1);
  const n = signatures.length;
  const idf = (k) => Math.log((n + 1) / (df.get(k) || 1));
  // 只出现一次的 token 的权重：语料大小变了，「够少见」的尺子跟着变
  idf.max = Math.log(n + 1);
  return idf;
}

// 「2.0」「3.0」这种整数版本号常被当形容词用（智能体 2.0、AI 3.0），算不上具体实体
const ROUND_VERSION = /^#\d+\.0$/;

// 返回 { sim: 加权 Jaccard, overlap: 交集占较短一方的比重, anchor: 共享实体的权重和,
//        rarity: anchor 相当于几个「只出现一次的 token」, shared: 共享的具体实体个数,
//        contained: 实体较少一方的实体是否全部出现在另一方 }
export function compare(a, b, idf) {
  let inter = 0, wa = 0, wb = 0, anchor = 0, shared = 0, sharedAll = 0;
  for (const k of a.tokens) {
    const w = idf(k);
    wa += w;
    if (b.tokens.has(k)) {
      inter += w;
      if (a.anchors.has(k) && b.anchors.has(k)) {
        anchor += w;
        sharedAll++;
        if (!ROUND_VERSION.test(k)) shared++;
      }
    }
  }
  for (const k of b.tokens) wb += idf(k);
  const union = wa + wb - inter;
  return {
    sim: union > 0 ? inter / union : 0,
    overlap: Math.min(wa, wb) > 0 ? inter / Math.min(wa, wb) : 0,
    anchor,
    rarity: idf.max > 0 ? anchor / idf.max : 0,
    shared,
    contained: sharedAll > 0 && sharedAll === Math.min(a.anchors.size, b.anchors.size),
  };
}

// 判同（①–③ 的阈值在 600 条真实数据上逐对人工看过，④ 在线上 1200 条上看过）：
//   ① 共享了少见的实体（专名 / 数字），标题再有一点重合
//   ② 只共享常见实体（如 OpenAI），那标题本身要大半重合
//   ③ 没有任何共享实体的纯中文标题，要求很高的重合
//   ④ 一长一短的两个标题：长标题的修饰语会把 Jaccard 稀释到 ① 的线以下
//     （「Mistral发布1T参数新模型Mistral Large 4，瞄准超越中外竞品」对「Mistral 发布 Mistral Large 4 预览版」）。
//     这时看实体：一方的实体全部出现在另一方，其中至少两个是具体的、合起来够少见，标题再有一点重合。
//     只用于不同信源之间——同一家媒体里共享实体的多半是系列稿（大会的各场演讲、同一栏目的各期），不是同一件事。
export function sameEvent({ sim, overlap, anchor, rarity = 0, shared = 0, contained = false }, { crossSource = false } = {}) {
  if (anchor >= 4 && sim >= 0.16) return true;
  if (anchor > 0 && sim >= 0.25 && overlap >= 0.55) return true;
  if (crossSource && contained && shared >= 2 && rarity >= 1.1 && sim >= 0.1) return true;
  return sim >= 0.4;
}

// 同一类事实会换说法。辞职 / 卸任 / 罢免 / 接班指的是领导层变动这一件，
// 请愿、回归、恢复职务是它的后续角度，不是另一件只是提到同一个人的事。
const HARD_FRAME = /辞职|卸任|辞任|离任|离职|罢免|下台|换帅|接班|继任|接任|辞去|接替|复职|请辞|去职|停职|撤职|出任|任命/;
// 「回归」单独出现太宽（「回归常规」不是请他回来）。要和「求 / 重返 / 职务」连在一起。
const ANGLE_FRAME = /请愿|求回归|重返|恢复[^，。；\n]{0,24}职务/;
const FRAME_MARK = /辞职|卸任|辞任|离任|离职|罢免|下台|换帅|接班|继任|接任|辞去|接替|复职|请辞|去职|停职|撤职|出任|任命|请愿|求回归|重返|职务/;
// 虚词进了三字组就不是人名或公司名
const PARTICLE = /[的了是在不与和或及将已被把对为从向以而但就也都还很最更这那其个中上下后前内外称未没正并于到让给所之乎吗呢吧啊呀嘛此正]/;
const CJK_STOP = new Set([
  '人工智能', '大模型', '开发者', '董事会', '创始人', '负责人', '机器人',
  '安全部', '全部门', '部门员', '门员工', '员工辞', '工辞职', '员工离', '工离职',
  '首席执', '席执行', '执行官', '临时任', '开源社',
]);
const EN_STOP = new Set([
  ...STOPWORDS, ...GENERIC,
  'ceo', 'cfo', 'cto', 'coo', 'ipo', 'ai', 'llm', 'gpu', 'api', 'app',
  'huang', 'musk', 'elon', 'trump', 'cook', 'techcrunch', 'verge', 'hacker', 'news',
  'infoq', 'download', 'daily', 'review', 'technology', 'media', 'times', 'post', 'blog', 'show',
]);
// 中英标题里的同一个主体。只收写法不同、指同一人或者同一家公司的名字。
const SUBJECT_ALIAS = [
  ['@nvidia', /英伟达|\bnvidia\b/i],
  ['@jensen', /黄仁勋|\bjensen\b/i],
  ['@kress', /克雷斯|\bkress\b/i],
  ['@openai', /\bopenai\b/i],
  ['@anthropic', /\banthropic\b/i],
  ['@google', /谷歌|\bgoogle\b|\bdeepmind\b/i],
  ['@microsoft', /微软|\bmicrosoft\b/i],
  ['@apple', /苹果|\bapple\b/i],
  ['@meta', /\bmeta\b|\bfacebook\b/i],
  ['@tesla', /特斯拉|\btesla\b/i],
  ['@hf', /huggingface|hugging face/i],
];
const COMPANY_KEY = new Set([
  '@nvidia', '@openai', '@anthropic', '@google', '@microsoft', '@apple', '@meta', '@tesla', '@hf',
  'nvidia', 'openai', 'anthropic', 'google', 'microsoft', 'apple', 'meta', 'tesla', 'huggingface', 'deepmind',
  '英伟达', '谷歌', '微软', '苹果', '百度', '腾讯', '华为', '特斯拉',
]);

function titleText(post) {
  return `${post.title_zh || ''} ${post.title || ''}`;
}

function summaryText(post) {
  return String(post.summary_zh || post.summary || '');
}

function cjkSubjects(title) {
  const keys = new Set();
  for (const seg of String(title).match(/[㐀-䶿一-鿿]{3,}/g) || []) {
    for (let i = 0; i < seg.length - 2; i++) {
      const g = seg.slice(i, i + 3);
      if (PARTICLE.test(g) || CJK_STOP.has(g) || FRAME_MARK.test(g)) continue;
      keys.add(g);
    }
  }
  return keys;
}

function subjectsOf(post) {
  const title = titleText(post);
  const keys = new Set();
  for (const [key, re] of SUBJECT_ALIAS) if (re.test(title)) keys.add(key);
  for (const w of String(title).match(/[A-Z][a-zA-Z0-9-]{2,}/g) || []) {
    const k = w.toLowerCase();
    if (!EN_STOP.has(k)) keys.add(k);
  }
  for (const g of cjkSubjects(title)) keys.add(g);
  return keys;
}

function summaryMentions(summary, keys) {
  const s = summary.toLowerCase();
  for (const k of keys) {
    if (k === '@nvidia' && (/nvidia/.test(s) || summary.includes('英伟达'))) return true;
    if (k === '@jensen' && (/jensen/.test(s) || summary.includes('黄仁勋'))) return true;
    if (k === '@kress' && (/kress/.test(s) || summary.includes('克雷斯'))) return true;
    if (k === '@openai' && /openai/.test(s)) return true;
    if (k === '@anthropic' && /anthropic/.test(s)) return true;
    if (k === '@google' && (/google|deepmind/.test(s) || summary.includes('谷歌'))) return true;
    if (k === '@microsoft' && (/microsoft/.test(s) || summary.includes('微软'))) return true;
    if (k === '@apple' && (/apple/.test(s) || summary.includes('苹果'))) return true;
    if (k === '@meta' && (/meta|facebook/.test(s))) return true;
    if (k === '@tesla' && (/tesla/.test(s) || summary.includes('特斯拉'))) return true;
    if (k === '@hf' && /hugging/.test(s)) return true;
    if (!k.startsWith('@') && (summary.includes(k) || s.includes(k))) return true;
  }
  return false;
}

// hard：标题或摘要里把领导层变动说出来了，而且摘要里的说法对着标题里的主体，不是顺手提了一句。
// angle：请愿、回归、恢复职务，自己不构成另一件核心事实。
function frameOf(post) {
  const title = titleText(post);
  const summary = summaryText(post);
  const keys = subjectsOf(post);
  const summaryAboutSubject = summaryMentions(summary, keys);
  if (HARD_FRAME.test(title) || (HARD_FRAME.test(summary) && summaryAboutSubject)) return 'hard';
  if (ANGLE_FRAME.test(title) || (ANGLE_FRAME.test(summary) && summaryAboutSubject)) return 'angle';
  return '';
}

function shares(a, b, pred) {
  for (const k of a) if (b.has(k) && pred(k)) return true;
  return false;
}

// 两篇是不是同一件还在发展的事。只看主体和事实类别，不把标题重合度的线放低。
export function sameDeveloping(a, b) {
  const fa = frameOf(a);
  const fb = frameOf(b);
  if (!fa || !fb) return false;
  const as = subjectsOf(a);
  const bs = subjectsOf(b);
  if (!shares(as, bs, () => true)) return false;
  if (fa === 'angle' || fb === 'angle') return shares(as, bs, (k) => !COMPANY_KEY.has(k));
  return true;
}

// 两篇稿子的实体对得上：规则 ④ 去掉「不同信源」和「标题重合」两条，只留实体的部分
const sameEntities = (c) => c.contained && c.shared >= 2 && c.rarity >= 1.1;

// posts: [{ id, title, title_zh, source, created_at, noise, event_id }]
// frozenBefore 之前的条目保持原 event_id，只作为被并入的对象；之后的每轮从头重算，
// 这样标题中文化完成后（title_zh 才出现）能重新判断。按时间顺序处理，事件 id 取最早成员的 id，
// 所以结果与处理批次无关、可重复执行。
//
// 新稿归到和它最像的那篇所在的事件。如果它同时认出了两个事件里的稿子，并且三篇两两实体都对得上，
// 说明这两个事件其实是一件事，并成一个——否则一件事最早的两篇（比如同在 Hacker News 的两个帖子，
// 同信源不走规则 ④）各立一个事件，后来的报道会一边挂一家，读者看到两条。
// 两道保险：新稿和那两篇都不同源（同一家媒体的系列稿不能靠自家的下一篇串起来）；
// 三篇两两都要对得上（只写 TTS 的第三方稿，不能把同一天发布的 TTS 和 Live 两个产品串成一件事）。
// 返回 Map<postId, eventId>。
export function assignEvents(posts, { frozenBefore = 0 } = {}) {
  const sorted = [...posts].sort((a, b) =>
    new Date(a.created_at) - new Date(b.created_at) || a.id - b.id);
  const sigs = sorted.map((p) => eventSignature(p.title_zh || p.title));
  const idf = buildIdf(sigs);
  const order = new Map(sorted.map((p, i) => [p.id, i]));
  const assigned = new Map();
  const members = new Map(); // eventId → [postId]
  const frozen = new Set();  // 含冻结成员的事件，归属不再动
  const join = (postId, eventId) => {
    assigned.set(postId, eventId);
    if (!members.has(eventId)) members.set(eventId, []);
    members.get(eventId).push(postId);
  };
  // 两个事件并成一个，id 仍取最早成员的
  const merge = (a, b) => {
    const [keep, drop] = order.get(a) <= order.get(b) ? [a, b] : [b, a];
    for (const id of members.get(drop)) join(id, keep);
    members.delete(drop);
    return keep;
  };
  const cross = (a, b) => !!a.source && !!b.source && a.source !== b.source;

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const t = new Date(p.created_at).getTime();
    if (t < frozenBefore && p.event_id) { join(p.id, p.event_id); frozen.add(p.event_id); continue; }
    const matches = [];
    // 合集稿（早报 / 周报）讲很多件事，不归入任何单一事件
    if (p.noise !== '合集') {
      for (let j = i - 1; j >= 0; j--) {
        const q = sorted[j];
        if (t - new Date(q.created_at).getTime() > EVENT_WINDOW_MS) break;
        if (q.noise === '合集') continue;
        const c = compare(sigs[i], sigs[j], idf);
        const lexical = sameEvent(c, { crossSource: cross(p, q) });
        // 发展中的事件：后续角度挂到核心事实上，不靠把上面的重合度阈值放低
        const developing = sameDeveloping(p, q);
        if (lexical || developing) {
          matches.push({
            j,
            sim: c.sim,
            bridge: developing || (cross(p, q) && sameEntities(c)),
            developing,
            lexical,
          });
        }
      }
    }
    if (!matches.length) { join(p.id, p.id); continue; }
    // 认得出是后续角度时，挂到这件事上，不让一篇只是用词更像的别的稿把它带走
    const devs = matches.filter((m) => m.developing);
    const pool = devs.length ? devs : matches;
    let best = pool[0];
    for (const m of pool) if (m.sim > best.sim) best = m;
    let target = assigned.get(sorted[best.j].id);
    for (const m of matches) {
      const other = assigned.get(sorted[m.j].id);
      if (other === target || frozen.has(other) || frozen.has(target)) continue;
      // 没有发展中匹配时，行为和原先一样：只有桥接稿才把两个事件并起来
      if (!m.bridge && !(m.lexical && devs.length)) continue;
      const linked = matches.some((n) => {
        if (assigned.get(sorted[n.j].id) !== target) return false;
        if (m.developing && n.developing) return sameDeveloping(sorted[m.j], sorted[n.j]);
        // 后续角度和某篇判成了同一件事：那一篇所在的事件并进来，别留成第二条精选
        if ((m.lexical && n.developing) || (m.developing && n.lexical)) return true;
        return n.bridge && sameEntities(compare(sigs[m.j], sigs[n.j], idf));
      });
      if (linked) target = merge(other, target);
    }
    join(p.id, target);
  }
  return assigned;
}
