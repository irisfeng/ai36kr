// 编辑环节：每条新资料过一次模型，同时拿到评分、中文标题和答案先行的摘要。
// 标准在 prompts/editor.js。没有 ARK_API_KEY 时整个环节跳过：
// 标题仍由 lib/translate.js 的机翻兜底，入选改用 lib/editorial.js 的估分。
import { EDITOR_PROMPT } from '../prompts/editor.js';
import { applyTermFixes, needsTranslation } from './translate.js';

const ARK_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const ARK_MODEL = process.env.ARK_EDITOR_MODEL || process.env.ARK_TRANSLATE_MODEL || 'doubao-seed-2-0-lite-260428';
const BATCH = 6;
// 一次调用要几十秒：几批同时发，整个环节再设一个时间预算，超了就把剩下的留给下一轮
const CONCURRENCY = 3;
const BUDGET_MS = 4 * 60000;
const TIMEOUT_MS = 40000;
const MAX_ATTEMPTS = 3;

// 把模型回答解析成与输入等长的结果数组；任何不合格式的情况返回 null（整批重试）
export function parseEditorReply(raw, size) {
  let arr;
  try {
    arr = JSON.parse(String(raw || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return null;
  }
  if (!Array.isArray(arr) || arr.length !== size) return null;
  const out = new Array(size).fill(null);
  for (const item of arr) {
    const i = Number(item?.i);
    const score = Number(item?.score);
    if (!Number.isInteger(i) || i < 0 || i >= size || out[i]) return null;
    if (!Number.isFinite(score)) return null;
    out[i] = {
      score: Math.max(0, Math.min(100, Math.round(score))),
      title: String(item.title || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      summary: String(item.summary || '').replace(/\s+/g, ' ').trim().slice(0, 200),
    };
  }
  return out.every(Boolean) ? out : null;
}

// 防编造的机械兜底：摘要里出现了输入中找不到的两位以上数字，这条摘要不用
//（数字是最常见、也最容易核对的编造；宁可退回 RSS 原摘要）
export function inventsNumbers(summary, sourceText) {
  const have = new Set(String(sourceText).match(/\d+(?:\.\d+)?/g) || []);
  return (String(summary).match(/\d+(?:\.\d+)?/g) || []).some((n) => n.length >= 2 && !have.has(n));
}

async function callEditor(items) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ARK_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${process.env.ARK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ARK_MODEL,
        messages: [
          { role: 'system', content: EDITOR_PROMPT },
          { role: 'user', content: JSON.stringify(items) },
        ],
        max_tokens: 2400,
        temperature: 0.2,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parseEditorReply(data?.choices?.[0]?.message?.content, items.length);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 整批失败时对半拆开重试，定位到单条仍失败就放弃这一条（记一次尝试）
async function editChunk(items) {
  const result = await callEditor(items.map((it, i) => ({ ...it, i })));
  if (result) return result;
  if (items.length <= 1) return [null];
  const mid = Math.ceil(items.length / 2);
  const [a, b] = await Promise.all([editChunk(items.slice(0, mid)), editChunk(items.slice(mid))]);
  return [...a, ...b];
}

// 每轮聚合后调用：给近 3 天还没评分的条目评分并写稿。噪声条目不花钱。
// 失败的条目累计 score_tries，到上限不再重试（入选退回估分），避免坏数据每轮空转。
// 预算用完时还没送出去的批次原样留着（不记失败），下一轮接着评
export async function editPosts(db, limit = 30, { budgetMs = BUDGET_MS } = {}) {
  if (!process.env.ARK_API_KEY) return { edited: 0, failed: 0 };
  const since = new Date(Date.now() - 3 * 86400000).toISOString();
  const rows = db.prepare(
    `SELECT id, title, summary, source FROM posts
     WHERE score IS NULL AND score_tries < ? AND COALESCE(noise, '') = '' AND is_external = 1 AND created_at >= ?
     ORDER BY created_at DESC LIMIT ?`
  ).all(MAX_ATTEMPTS, since, limit);
  if (!rows.length) return { edited: 0, failed: 0 };

  const save = db.prepare(
    `UPDATE posts SET score = ?, title_zh = COALESCE(?, title_zh), summary_zh = COALESCE(?, summary_zh) WHERE id = ?`
  );
  const miss = db.prepare('UPDATE posts SET score_tries = score_tries + 1 WHERE id = ?');
  let edited = 0;
  let failed = 0;
  const batches = [];
  for (let i = 0; i < rows.length; i += BATCH) batches.push(rows.slice(i, i + BATCH));
  const deadline = Date.now() + budgetMs;
  let next = 0;
  const worker = async () => {
    while (next < batches.length && Date.now() < deadline) {
      const batch = batches[next++];
      const results = await editChunk(batch.map((r) => ({
        source: r.source,
        title: r.title,
        text: String(r.summary || '').slice(0, 400),
      })));
      batch.forEach((r, j) => {
        const out = results[j];
        if (!out) { miss.run(r.id); failed++; return; }
        const sourceText = `${r.title} ${r.summary}`;
        // 中文原题不改写；外文标题才写入译名
        const title = needsTranslation(r.title) && out.title && out.title !== r.title
          ? applyTermFixes(out.title) : null;
        // 数字核对只对中文原文做：外文译成中文会换单位（30 billion → 300 亿），对不上是正常的
        const checkable = !needsTranslation(r.title);
        const summary = out.summary && !(checkable && inventsNumbers(out.summary, sourceText))
          ? applyTermFixes(out.summary) : null;
        save.run(out.score, title, summary, r.id);
        edited++;
      });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { edited, failed };
}
