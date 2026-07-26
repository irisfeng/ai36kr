// 标题中文化：Google Translate 公开端点（gtx），无需密钥，低频小批量使用
// 结果写回 posts.title_zh 永久缓存；失败置 '' 不再重试
const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const TIMEOUT_MS = 8000;

// 不含任何中日韩字符才需要翻译
export function needsTranslation(title = '') {
  return !/[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/.test(title);
}

// 译后术语校正：机翻在 AI 领域的经典错误，宁可保守也不多替换
const TERM_FIXES = [
  [/开放重量(级)?/g, '开放权重'],   // open-weight
  [/开源重量(级)?/g, '开源权重'],
  [/克劳德/g, 'Claude'],            // Claude 不译名更达意
  [/双子座/g, 'Gemini'],
  [/人择/g, 'Anthropic'],
  [/深寻/g, 'DeepSeek'],
];
export function applyTermFixes(text = '') {
  let out = text;
  for (const [re, to] of TERM_FIXES) out = out.replace(re, to);
  return out;
}

export async function translateText(text) {
  const u = `${ENDPOINT}?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(u, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    // 返回结构：[ [ [译文, 原文, ...], ... ], ... ]
    const out = (data?.[0] || []).map((seg) => seg?.[0] || '').join('').trim();
    return out ? applyTermFixes(out) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 每轮聚合后调用：近 14 天内待译标题限量翻译
export async function translateTitles(db, limit = 20) {
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const rows = db
    .prepare('SELECT id, title FROM posts WHERE title_zh IS NULL AND created_at >= ? ORDER BY created_at DESC LIMIT ?')
    .all(since, limit * 3)
    .filter((r) => needsTranslation(r.title))
    .slice(0, limit);
  if (!rows.length) return 0;
  const stmt = db.prepare('UPDATE posts SET title_zh = ? WHERE id = ?');
  let done = 0;
  for (let i = 0; i < rows.length; i += 5) {
    const batch = rows.slice(i, i + 5);
    const translated = await Promise.all(batch.map((r) => translateText(r.title)));
    batch.forEach((r, j) => {
      const zh = translated[j];
      stmt.run(zh && zh !== r.title ? zh : '', r.id);
      if (zh && zh !== r.title) done++;
    });
  }
  return done;
}
