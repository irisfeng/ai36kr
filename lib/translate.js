// 标题中文化：Google Translate 公开端点（gtx），无需密钥，低频小批量使用
// 结果写回 posts.title_zh 永久缓存；失败置 '' 不再重试
const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const TIMEOUT_MS = 8000;

// 不含任何中日韩字符才需要翻译
export function needsTranslation(title = '') {
  return !/[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/.test(title);
}

// 标题中文化：LLM（火山方舟，首选）+ gtx（兜底）
// 词表持久化在 glossary 表（lib/glossary.js），此处不再硬编码
import { getGlossary } from './glossary.js';

// 译后术语校正（词表来自 glossary 表，支持运行期热更新）
export function applyTermFixes(text = '') {
  let out = text;
  for (const [re, to] of getGlossary().fix) out = out.replace(re, to);
  return out;
}

// 译前占位保护：gtx 会把 LLM→法学硕士、Cursor→光标、Copilot→副驾驶，
// 先把易误译术语换成占位符（实测 gtx 原样保留），译后还原
function protectTerms(text) {
  const map = new Map();
  let out = text;
  for (const term of getGlossary().protect) {
    const re = new RegExp(`(^|[^A-Za-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])`, 'g');
    out = out.replace(re, (m, pre) => {
      if (!map.has(term)) map.set(term, `Zxq${map.size}zx`);
      return `${pre}${map.get(term)}`;
    });
  }
  return { protectedText: out, map };
}

function restoreTerms(text, map) {
  let out = text;
  for (const [term, token] of map) out = out.split(token).join(term);
  return out;
}

export async function translateText(text) {
  const { protectedText, map } = protectTerms(text);
  const u = `${ENDPOINT}?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(protectedText)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(u, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    // 返回结构：[ [ [译文, 原文, ...], ... ], ... ]
    const out = (data?.[0] || []).map((seg) => seg?.[0] || '').join('').trim();
    return out ? applyTermFixes(restoreTerms(out, map)) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---- LLM 批量翻译（首选）：火山方舟 Ark（OpenAI 兼容），语境理解准确 ----
// 无 ARK_API_KEY 时回退 gtx 逐条（有占位保护 + 校正兜底）
const ARK_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const ARK_MODEL = process.env.ARK_TRANSLATE_MODEL || 'doubao-seed-2-0-lite-260428';

const LLM_PROMPT = `你是 AI 领域的专业译者，为中文科技媒体翻译新闻标题。要求：
1. 依据标题的语境语义翻译，不逐字直译。例如 open-weight 译「开放权重」而非「开放重量」；LLM 指大语言模型，绝不是法学硕士；Apple 指苹果公司。
2. 以下术语一律保留英文原文：LLM, GPT, Claude, Gemini, DeepSeek, Qwen, Kimi, Sora, Grok, Llama, Mistral, Copilot, Cursor, Windsurf, Transformer, LoRA, MoE, RLHF, RAG, SFT, vLLM, MCP, Jupyter, Ollama, Hugging Face, LangChain, LlamaIndex, OpenAI, Anthropic, NVIDIA, CUDA, API, Agent, Kubernetes, PyTorch。
3. 公司与产品名保留原文（OpenAI, Google, Meta, Microsoft, Apple, Amazon, Tesla, xAI, DeepMind）。
4. 译文须为通顺简洁的中文新闻标题，不超过 40 字。
5. 只输出 JSON 字符串数组，与输入等长，不要任何解释。`;

async function translateBatchLLM(texts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(ARK_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${process.env.ARK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ARK_MODEL,
        messages: [
          { role: 'system', content: LLM_PROMPT },
          { role: 'user', content: `把以下 JSON 数组中的英文标题逐条译成中文：\n${JSON.stringify(texts)}` },
        ],
        max_tokens: 1200,
        temperature: 0.2,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || '';
    const arr = JSON.parse(raw.replace(/^```(?:json)?|```$/g, '').trim());
    if (!Array.isArray(arr) || arr.length !== texts.length) return null;
    return arr.map((s) => applyTermFixes(String(s || '').trim()) || null);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 批量入口：优先 LLM；整批失败（解析错/条数不齐）时递归拆小，单条兜底 gtx
export async function translateBatch(texts) {
  if (process.env.ARK_API_KEY && texts.length) {
    return llmChunk(texts);
  }
  return Promise.all(texts.map((t) => translateText(t)));
}

async function llmChunk(texts) {
  const r = await translateBatchLLM(texts);
  if (r) return r;
  if (texts.length <= 1) return [await translateText(texts[0])];
  const mid = Math.ceil(texts.length / 2);
  const [a, b] = await Promise.all([
    llmChunk(texts.slice(0, mid)),
    llmChunk(texts.slice(mid)),
  ]);
  return [...a, ...b];
}

// 存量译文自动校正：新加 fix 词条后，下一轮聚合自动回扫近 30 天译文
export async function refixTitles(db) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const rows = db
    .prepare("SELECT id, title_zh FROM posts WHERE title_zh IS NOT NULL AND title_zh != '' AND created_at >= ? LIMIT 300")
    .all(since);
  const upd = db.prepare('UPDATE posts SET title_zh = ? WHERE id = ?');
  let fixed = 0;
  for (const r of rows) {
    const better = applyTermFixes(r.title_zh);
    if (better !== r.title_zh) {
      upd.run(better, r.id);
      fixed++;
    }
  }
  return fixed;
}

// 每轮聚合后调用：待译标题限量翻译
// 不设时间窗：失败行已标 '' 不会重试，NULL 行按新到旧逐轮排空（深度长文留存 90 天，不设窗才不遗漏）
// 注意：中文文章 title_zh 恒为 NULL，会占住排序靠前的位置，故取较大 LIMIT 再过滤
export async function translateTitles(db, limit = 20) {
  const rows = db
    .prepare('SELECT id, title FROM posts WHERE title_zh IS NULL ORDER BY created_at DESC LIMIT 300')
    .all()
    .filter((r) => needsTranslation(r.title))
    .slice(0, limit);
  if (!rows.length) return 0;
  const stmt = db.prepare('UPDATE posts SET title_zh = ? WHERE id = ?');
  let done = 0;
  // 整批一次 LLM 调用（15 条/批，超出分批）
  for (let i = 0; i < rows.length; i += 15) {
    const batch = rows.slice(i, i + 15);
    const translated = await translateBatch(batch.map((r) => r.title));
    batch.forEach((r, j) => {
      const zh = translated[j];
      stmt.run(zh && zh !== r.title ? zh : '', r.id);
      if (zh && zh !== r.title) done++;
    });
  }
  return done;
}
