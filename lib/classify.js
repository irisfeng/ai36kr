// 聚合条目的分类归一：按标题+摘要关键词打分，命中最多的分类胜出
import { CATEGORIES } from './categories.js';

// 顺序即平局时的优先级；词表全部小写比较，中文直接包含匹配
const RULES = [
  ['AI创投', [
    '融资', '投资', '估值', '上市', 'ipo', '收购', '并购', '募资', '轮融',
    'funding', 'raises', 'raised', 'series a', 'series b', 'series c', 'series d',
    'valuation', 'investment', 'investor', 'venture', 'acquires', 'acquisition', 'ipo', 'billion',
  ]],
  ['政策监管', [
    '监管', '政策', '法案', '立法', '禁令', '合规', '反垄断', '诉讼', '起诉', '罚款', '审查',
    'regulation', 'regulator', 'policy', 'ban ', 'banned', 'law', 'lawsuit', 'sues', 'sued',
    'antitrust', 'ftc', 'eu ai act', 'executive order', 'congress', 'senate', 'court', 'fine', 'probe',
  ]],
  ['芯片算力', [
    '芯片', '算力', '晶圆', '光刻', '存储芯片', '国产芯片',
    'chip', 'chips', 'gpu', 'nvidia', '英伟达', 'amd', 'intel', 'tsmc', '台积电', 'semiconductor',
    'wafer', 'hbm', 'data center chip', 'accelerator',
  ]],
  ['具身智能', [
    '具身', '机器人', '人形机器人', '机械臂', '自动驾驶', '无人车', '无人机',
    'robot', 'robots', 'robotics', 'humanoid', 'embodied', 'self-driving', 'autonomous vehicle',
    'optimus', 'figure ai', 'waymo', 'drone',
  ]],
  ['开源社区', [
    '开源', '开放权重', '开源模型',
    'open source', 'open-source', 'open weights', 'open-weight', 'github', 'hugging face',
    'huggingface', 'llama', 'mistral', 'apache license', 'mit license',
  ]],
  ['Agent', [
    '智能体', '代理', '数字员工', 'agent', 'agents', 'agentic', 'copilot', 'auto-gpt',
    'computer use', 'tool use', 'workflow', 'multi-agent', 'mcp',
  ]],
  ['大模型', [
    '大模型', '大语言模型', '多模态', '推理模型', '视频生成', '文生图', '文生视频', '预训练', '微调', '蒸馏',
    'gpt', 'claude', 'gemini', 'deepseek', 'qwen', '通义', 'kimi', '豆包', '文心', 'grok', 'sora',
    'llm', 'language model', 'foundation model', 'openai', 'anthropic', 'deepmind', 'xai',
    'multimodal', 'reasoning', 'diffusion', 'transformer', 'rag', 'fine-tun', 'context window',
    'text-to-image', 'text-to-video', 'benchmark',
  ]],
];

// 纯 ASCII 词用非字母数字边界匹配，避免 agent 命中 "management"、rag 命中 "storage"
function hit(text, word) {
  if (/^[\x20-\x7E]+$/.test(word)) {
    const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i').test(text);
  }
  return text.includes(word);
}

// AI 相关性闸门：通用源（HN/Ars/MIT TR/36氪）只放行命中 AI 专属词汇的条目。
// 词表只取 AI 技术相关的分类词（排除 AI创投/政策监管——「收购/融资/funding」
// 等通用财经词会让非 AI 财经新闻混进来），再加通用 AI 词（带词边界匹配）。
const GATE_CATS = new Set(['芯片算力', '具身智能', '开源社区', 'Agent', '大模型']);
const GATE_EXTRA = [
  'ai', 'aigc', 'agi', 'artificial intelligence', 'machine learning', 'deep learning',
  'neural network', 'chatbot', 'chatgpt', 'genai', 'generative', '人工智能', '智能体',
  '机器学习', '深度学习', '大模型', '通用人工智能', '半导体',
];
const GATE_WORDS = [
  ...new Set([
    ...RULES.filter(([cat]) => GATE_CATS.has(cat)).flatMap(([, words]) => words),
    ...GATE_EXTRA,
  ]),
];

export function isAiRelated(title = '', summary = '') {
  const text = `${title} ${summary}`.toLowerCase();
  return GATE_WORDS.some((w) => hit(text, w));
}

// 标题归一化：跨源同一新闻的标题差异（标点/空白/大小写）抹平，用于去重
export function normalizeTitle(title = '') {
  return String(title).toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '').slice(0, 190);
}

export function classifyPost(title = '', summary = '') {
  const text = `${title} ${summary}`.toLowerCase();
  let best = '大模型';
  let bestScore = 0;
  for (const [cat, words] of RULES) {
    let score = 0;
    for (const w of words) if (hit(text, w)) score++;
    if (score > bestScore) { best = cat; bestScore = score; }
  }
  return CATEGORIES.includes(best) ? best : '大模型';
}
