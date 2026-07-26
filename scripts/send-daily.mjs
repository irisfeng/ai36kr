// 每日 08:00（北京时间）向已确认订阅者发送「今日 AI 一页」
// 用法：node scripts/send-daily.mjs（CI daily-digest.yml 调用；本地需 RESEND_API_KEY）
import db from '../lib/db.js';
import { attachReactions } from '../lib/queries.js';
import { hotWords } from '../lib/keywords.js';
import { sendEmail, dailyEmailHtml } from '../lib/email.js';

const SITE = 'https://aikr.shddai.net';

// 与 /daily 页一致的 24h 窗口（空则 48h）
let windowH = 24;
let rows = db.prepare(
  `SELECT p.*, (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
   FROM posts p WHERE p.created_at >= ? ORDER BY p.created_at DESC LIMIT 200`
).all(new Date(Date.now() - 24 * 3600000).toISOString());
if (!rows.length) {
  windowH = 48;
  rows = db.prepare(
    `SELECT p.*, (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
     FROM posts p WHERE p.created_at >= ? ORDER BY p.created_at DESC LIMIT 200`
  ).all(new Date(Date.now() - 48 * 3600000).toISOString());
}

const posts = attachReactions(rows);
const words = hotWords(posts, 8);
const attention = (p) => (p.up - p.down) + Object.values(p.reactions || {}).reduce((a, b) => a + b, 0);
const top3 = [...posts].sort((a, b) => attention(b) - attention(a)).slice(0, 3);

const byCat = new Map();
for (const p of posts) {
  if (!byCat.has(p.category)) byCat.set(p.category, []);
  byCat.get(p.category).push(p);
}
const groups = [...byCat.entries()].sort((a, b) => b[1].length - a[1].length);

const now = new Date(Date.now() + 8 * 3600000);
const dateStr = `${now.getUTCFullYear()} 年 ${now.getUTCMonth() + 1} 月 ${now.getUTCDate()} 日`;

const subscribers = db.prepare('SELECT email, token FROM subscribers WHERE confirmed = 1').all();
console.log(`日报内容：${posts.length} 条（${windowH}h），订阅者 ${subscribers.length} 人`);

if (!subscribers.length) {
  console.log('无已确认订阅者，跳过发送');
  process.exit(0);
}

let sent = 0, failed = 0;
for (const sub of subscribers) {
  try {
    await sendEmail({
      to: sub.email,
      subject: `听潮 · 今日 AI 一页（${dateStr}）`,
      html: dailyEmailHtml({
        dateStr, words, top3, groups, total: posts.length,
        unsubUrl: `${SITE}/api/subscribe/unsubscribe?token=${sub.token}`,
        dailyUrl: `${SITE}/daily`,
      }),
    });
    sent++;
  } catch (e) {
    failed++;
    console.warn(`发送失败 ${sub.email}: ${e.message}`);
  }
}
console.log(`日报发送完成：成功 ${sent} / 失败 ${failed}`);
if (failed && !sent) process.exit(1);
