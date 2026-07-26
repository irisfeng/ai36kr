// 跨源模糊去重：同一事件的不同标题表述，按词集 Jaccard 相似度归并
// 中文用二元组（bigram），英文用去停用词后的词干集合

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

export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

// 载入近期文章词集（每轮一次，防同轮/跨轮重复）
export function loadRecentSignatures(db, days = 7, limit = 1000) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const rows = db
    .prepare('SELECT id, title FROM posts WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?')
    .all(since, limit);
  const sigs = new Map();
  for (const r of rows) sigs.set(r.id, titleTokens(r.title));
  return sigs;
}

// 与近期文章词集比对，相似即视为重复（返回命中的 id 或 null）
export function findDuplicate(sigs, tokens, threshold = 0.6) {
  for (const [id, other] of sigs) {
    if (jaccard(tokens, other) >= threshold) return id;
  }
  return null;
}
