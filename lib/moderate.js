// 内容审核（评论/投稿）：本地敏感词与垃圾特征拦截（快、零成本）
// + Ark LLM 快审（语境判断，可选增强）；LLM 不可用时仅用本地规则放行
const BLOCK_WORDS = [
  '赌博', '博彩', '赌场', '赌球', '彩票', '六合彩', '百家乐', '时时彩',
  '约炮', '援交', '色情', '裸聊', '成人视频', 'AV', 'av女优',
  '代孕', '刷单', '刷信誉', '兼职日结', '打字员',
  '办证', '假证', '代开发票', '假发票', '发票代开',
  '毒品', '冰毒', '麻古', '摇头丸', 'k粉', '大麻',
  '枪支', '弹药', '炸药', '雷管', '自制枪',
  '代考', '作弊器', '外挂', '私服', '盗号', '洗钱', '跑分', '网赚',
];
const BLOCK_RE = new RegExp(BLOCK_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
// 广告导流特征：微信号/QQ群/联系方式
const SPAM_RE = /(加[Vv微]|微信|QQ|q群|tg|telegram|whatsapp|line[:：]?\s*[a-z0-9_\-]{4,}|联系[:：]?\s*\d{5,})/i;

export function localCheck(text = '') {
  if (BLOCK_RE.test(text)) return { ok: false, reason: '包含违禁内容' };
  if (SPAM_RE.test(text)) return { ok: false, reason: '包含导流信息（联系方式/群号）' };
  const links = (String(text).match(/https?:\/\//gi) || []).length;
  if (links > 2) return { ok: false, reason: '链接过多，疑似广告' };
  return { ok: true };
}

const ARK_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const ARK_MODEL = process.env.ARK_TRANSLATE_MODEL || 'doubao-seed-2-0-lite-260428';

// LLM 快审：只拦明确违规；拿不准一律放行（宁可漏审，不可误伤）
async function llmCheck(text) {
  if (!process.env.ARK_API_KEY) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
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
          { role: 'system', content: '你是中文科技新闻社区的内容审核员。判断用户提交的内容是否适合公开发布。只拦截：垃圾广告、导流、色情、赌博、毒品、武器、辱骂攻击、违法违规。观点尖锐、抬杠、跑题、灌水都允许。只输出 JSON：{"safe": true|false, "reason": "10字内原因"}。拿不准一律 safe=true。' },
          { role: 'user', content: text.slice(0, 800) },
        ],
        max_tokens: 80,
        temperature: 0,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, '').trim());
    return typeof parsed?.safe === 'boolean'
      ? { ok: parsed.safe, reason: parsed.safe ? '' : (parsed.reason || '内容不适宜发布') }
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 入口：先本地，后 LLM；LLM 不可用/超时按本地结果
export async function moderateContent(text) {
  const local = localCheck(text);
  if (!local.ok) return local;
  const llm = await llmCheck(text);
  return llm || { ok: true };
}
