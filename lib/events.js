// 事件聚簇：不同信源报道的同一件事归成一个事件，读者只看到一次。
// 原先的做法是「相似就丢弃后到者」——去了重，也丢掉了「有几家在报」这个最有用的信号。
//
// 没有向量服务，用标题文字重合度：在中文展示标题（title_zh || title）上取
// 中文二元组 + 英文词 + 数字，按 IDF 加权（「正式发布」「全新」这类词不值钱，
// 「Akamai」「116」值钱）。判同规则偏保守：错并会藏掉一条新闻，漏并只是多显示一条。

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

// posts: [{ id, title, title_zh, source, created_at, noise, event_id }]
// frozenBefore 之前的条目保持原 event_id，只作为被并入的对象；之后的每轮从头重算，
// 这样标题中文化完成后（title_zh 才出现）能重新判断。按时间顺序处理，事件 id 取最早成员的 id，
// 所以结果与处理批次无关、可重复执行。
// 返回 Map<postId, eventId>。
export function assignEvents(posts, { frozenBefore = 0 } = {}) {
  const sorted = [...posts].sort((a, b) =>
    new Date(a.created_at) - new Date(b.created_at) || a.id - b.id);
  const sigs = sorted.map((p) => eventSignature(p.title_zh || p.title));
  const idf = buildIdf(sigs);
  const assigned = new Map();
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const t = new Date(p.created_at).getTime();
    if (t < frozenBefore && p.event_id) { assigned.set(p.id, p.event_id); continue; }
    let best = null;
    let bestSim = 0;
    // 合集稿（早报 / 周报）讲很多件事，不归入任何单一事件
    if (p.noise !== '合集') {
      for (let j = i - 1; j >= 0; j--) {
        const q = sorted[j];
        if (t - new Date(q.created_at).getTime() > EVENT_WINDOW_MS) break;
        if (q.noise === '合集') continue;
        const c = compare(sigs[i], sigs[j], idf);
        const crossSource = !!p.source && !!q.source && p.source !== q.source;
        if (c.sim > bestSim && sameEvent(c, { crossSource })) { best = q; bestSim = c.sim; }
      }
    }
    assigned.set(p.id, best ? assigned.get(best.id) : p.id);
  }
  return assigned;
}
