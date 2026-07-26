// 翻译词表：glossary 表持久化（kind=protect 译前保原文 / kind=fix 译后替换），
// 空表时用代码种子写入；运行期 5 分钟内存缓存，加词无需改代码、下一轮自动生效
import db from './db.js';

export const SEED_PROTECT = [
  'LLM', 'LoRA', 'MoE', 'RLHF', 'RAG', 'SFT', 'vLLM', 'MCP',
  'Claude', 'Kimi', 'Qwen', 'Grok', 'Sora', 'Cursor', 'Windsurf', 'Copilot',
  'Llama', 'Mistral', 'Transformer', 'DeepSeek', 'Hugging Face', 'LangChain',
  'LlamaIndex', 'Jupyter', 'Ollama',
];

export const SEED_FIX = [
  ['开放重量(级)?', '开放权重'],
  ['开源重量(级)?', '开源权重'],
  ['法学硕士', 'LLM'],
  ['克劳德', 'Claude'],
  ['双子座', 'Gemini'],
  ['人择', 'Anthropic'],
  ['深寻', 'DeepSeek'],
  ['副驾驶', 'Copilot'],
  ['美洲驼', 'Llama'],
  ['变压器', 'Transformer'],
];

let cache = null;
let cacheAt = 0;
const TTL = 5 * 60 * 1000;

function load() {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM glossary').get();
  if (c === 0) {
    const ins = db.prepare('INSERT OR IGNORE INTO glossary (kind, from_text, to_text, created_at) VALUES (?, ?, ?, ?)');
    const now = new Date().toISOString();
    for (const t of SEED_PROTECT) ins.run('protect', t, t, now);
    for (const [f, to] of SEED_FIX) ins.run('fix', f, to, now);
  }
  const rows = db.prepare('SELECT kind, from_text, to_text FROM glossary').all();
  cache = {
    protect: rows.filter((r) => r.kind === 'protect').map((r) => r.from_text),
    fix: rows.filter((r) => r.kind === 'fix').map((r) => [new RegExp(r.from_text, 'g'), r.to_text]),
  };
  cacheAt = Date.now();
  return cache;
}

export function getGlossary() {
  if (!cache || Date.now() - cacheAt > TTL) return load();
  return cache;
}

export function bustGlossaryCache() {
  cacheAt = 0;
}
