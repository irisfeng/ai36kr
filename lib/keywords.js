// AI 领域热词词典 + 词频统计：统计给定文章集合标题/摘要中的词典命中次数
export const AI_KEYWORDS = [
  'GPT', 'GPT-5', 'ChatGPT', 'Claude', 'Gemini', 'DeepSeek', 'Qwen', '通义千问', 'Kimi',
  '豆包', '文心一言', 'Llama', 'Mistral', 'Grok', 'Sora', 'OpenAI', 'Anthropic', 'DeepMind',
  'xAI', 'Meta AI', 'Agent', '智能体', '具身智能', '人形机器人', '机器人', '开源', '融资',
  '芯片', 'GPU', '英伟达', '算力', '多模态', '推理模型', 'RAG', '微调', '强化学习',
  'Transformer', 'Diffusion', 'AI编程', 'Cursor', 'Copilot', '大模型', '视频生成',
  '自动驾驶', 'MCP', '文生图', '基准测试', '幻觉', '上下文',
];

function countHits(text, word) {
  let hay = text;
  let needle = word;
  if (/^[\x20-\x7E]+$/.test(word)) {
    // 纯英文词按非字母数字边界、大小写不敏感计数
    const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = hay.match(new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'gi'));
    return m ? m.length : 0;
  }
  let n = 0;
  let i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

// posts: [{title, summary}]，返回 [{word, count}] 降序
export function hotWords(posts, limit = 8) {
  const corpus = posts.map((p) => `${p.title || ''} ${p.summary || ''}`).join('\n');
  if (!corpus.trim()) return [];
  const scored = AI_KEYWORDS
    .map((w) => ({ word: w, count: countHits(corpus, w) }))
    .filter((x) => x.count > 0);
  scored.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  return scored.slice(0, limit);
}
