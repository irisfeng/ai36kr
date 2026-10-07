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
        if (sameEvent(c, { crossSource: cross(p, q) })) matches.push({ j, sim: c.sim, bridge: cross(p, q) && sameEntities(c) });
      }
    }
    if (!matches.length) { join(p.id, p.id); continue; }
    let best = matches[0];
    for (const m of matches) if (m.sim > best.sim) best = m;
    let target = assigned.get(sorted[best.j].id);
    for (const m of matches) {
      const other = assigned.get(sorted[m.j].id);
      if (!m.bridge || other === target || frozen.has(other) || frozen.has(target)) continue;
      const linked = matches.some((n) => n.bridge && assigned.get(sorted[n.j].id) === target
        && sameEntities(compare(sigs[m.j], sigs[n.j], idf)));
      if (linked) target = merge(other, target);
    }
    join(p.id, target);
  }
  return assigned;
}
