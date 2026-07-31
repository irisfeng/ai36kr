// X（Twitter）每日一推：取 24h 最受关注 Top1 发到 X
// 用法：node scripts/post-x.mjs（CI daily-digest.yml 调用）
// 需要 4 个 secret（dev.twitter.com 免费开发者账号，Free 档 500 帖/月足够）：
//   X_API_KEY / X_API_SECRET（App 的 Consumer Keys）
//   X_ACCESS_TOKEN / X_ACCESS_SECRET（App 所属账号的 Access Token，需 Read+Write 权限）
// 缺一即静默跳过（exit 0），不影响日报主流程
import crypto from 'node:crypto';
import db from '../lib/db.js';
import { attachReactions } from '../lib/queries.js';

const SITE = 'https://aikr.shddai.net';
const REQUIRED = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.log(`X：缺少 ${missing.join(' / ')}，跳过发推`);
  process.exit(0);
}

// ---- 取今日最受关注 Top1（与日报同口径）----
let rows = db.prepare(
  `SELECT p.*, (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
   FROM posts p WHERE p.created_at >= ? ORDER BY p.created_at DESC LIMIT 200`
).all(new Date(Date.now() - 24 * 3600000).toISOString());
if (!rows.length) {
  rows = db.prepare(
    `SELECT p.*, (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
     FROM posts p WHERE p.created_at >= ? ORDER BY p.created_at DESC LIMIT 200`
  ).all(new Date(Date.now() - 48 * 3600000).toISOString());
}
if (!rows.length) {
  console.log('X：48h 无内容，跳过');
  process.exit(0);
}
const posts = attachReactions(rows);
const attention = (p) => (p.up - p.down) + Object.values(p.reactions || {}).reduce((a, b) => a + b, 0);
const top = [...posts].sort((a, b) => attention(b) - attention(a))[0];

// ---- 组推文（X 计宽：CJK 算 2，ASCII 算 1，上限 280）----
const weight = (s) => [...s].reduce((w, ch) => w + (ch.codePointAt(0) > 0x2e7f ? 2 : 1), 0);
const link = `${SITE}/post/${top.id}`;
const head = '【今日 AI 一页】';
const title = (top.title_zh || top.title).replace(/\s+/g, ' ').trim();
const summary = (top.summary_zh || top.summary || '').replace(/\s+/g, ' ').trim();
let text = `${head}${title}\n\n${summary}\n${link}`;
if (weight(text) > 275) {
  const budget = 275 - weight(`${head}${title}\n\n…\n${link}`);
  let cut = '';
  for (const ch of summary) {
    if (weight(cut + ch) > budget) break;
    cut += ch;
  }
  text = `${head}${title}\n\n${cut}…\n${link}`;
}
console.log(`X：发推内容（${weight(text)} 宽）\n${text}`);

// ---- OAuth 1.0a 签名（无第三方依赖）----
const pct = (s) => encodeURIComponent(s).replace(/[!*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const oauthParams = {
  oauth_consumer_key: process.env.X_API_KEY,
  oauth_nonce: crypto.randomBytes(16).toString('hex'),
  oauth_signature_method: 'HMAC-SHA1',
  oauth_timestamp: String(Math.floor(Date.now() / 1000)),
  oauth_token: process.env.X_ACCESS_TOKEN,
  oauth_version: '1.0',
};
const apiUrl = 'https://api.twitter.com/2/tweets';
// JSON body 不参与签名（OAuth 1.0a 仅签 oauth_* 与 query 参数）
const paramStr = Object.keys(oauthParams).sort().map((k) => `${pct(k)}=${pct(oauthParams[k])}`).join('&');
const baseStr = `POST&${pct(apiUrl)}&${pct(paramStr)}`;
const signingKey = `${pct(process.env.X_API_SECRET)}&${pct(process.env.X_ACCESS_SECRET)}`;
const signature = crypto.createHmac('sha1', signingKey).update(baseStr).digest('base64');
const authHeader = 'OAuth ' + Object.entries({ ...oauthParams, oauth_signature: signature })
  .map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(', ');

try {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const body = await res.text();
  if (res.status === 201) {
    console.log(`X：发推成功 ${body.slice(0, 120)}`);
  } else {
    // 重复推文/密钥失效/限流均不视为致命：明天 Top1 变了自然会发出
    console.warn(`X：HTTP ${res.status} ${body.slice(0, 300)}`);
  }
} catch (e) {
  console.warn(`X：请求失败 ${e.message}`);
}
