// 每日 08:00（北京时间）向已确认订阅者发送「今日 AI 一页」
// 用法：node scripts/send-daily.mjs（CI daily-digest.yml 调用；本地需 RESEND_API_KEY）
// 幂等：digest_log 按北京日历日去重——多时点调度下首个成功运行的实例发送，其余时点跳过
import fs from 'node:fs';
import db from '../lib/db.js';
import { attachReactions } from '../lib/queries.js';
import { hotWords } from '../lib/keywords.js';
import { sendEmail, dailyEmailHtml } from '../lib/email.js';

const SITE = 'https://aikr.shddai.net';

// GitHub Actions Step Summary：运行结果在 Actions 页面直接可见，无需下载日志
const summaryLines = [];
function flushSummary() {
  if (!process.env.GITHUB_STEP_SUMMARY || !summaryLines.length) return;
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryLines.join('\n') + '\n');
}

const now = new Date(Date.now() + 8 * 3600000);
const dateStr = `${now.getUTCFullYear()} 年 ${now.getUTCMonth() + 1} 月 ${now.getUTCDate()} 日`;
const dateKey = now.toISOString().slice(0, 10); // 北京日历日，幂等键

// 幂等闸门：今日已全量送达（failed=0）→ 备份时点跳过；
// 有部分失败 → 本时点只补发失败名单，不重复打扰已送达的订阅者
const already = db.prepare('SELECT sent, failed, failed_emails FROM digest_log WHERE sent_date = ?').get(dateKey);
if (already && already.sent > 0 && already.failed === 0) {
  console.log(`今日日报已发送（${already.sent} 人），备份时点跳过`);
  summaryLines.push('## 日报邮件', '', `⏭️ 今日（${dateKey}）已发送过（成功 ${already.sent} 人），本时点跳过。`);
  flushSummary();
  process.exit(0);
}
let retryEmails = null;
if (already && already.sent > 0 && already.failed > 0) {
  retryEmails = new Set(JSON.parse(already.failed_emails || '[]'));
  if (!retryEmails.size) {
    console.log('存在失败计数但无失败名单（旧格式记录），备份时点跳过');
    process.exit(0);
  }
  console.log(`补发模式：仅重投 ${retryEmails.size} 个失败邮箱`);
}

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
if (!rows.length) {
  // 48h 仍无内容 = 数据链路故障，而非"今天没新闻"：不发空邮件，
  // 以失败退出触发 GitHub 告警，后续备份时点会自动重试
  summaryLines.push('## 日报邮件', '', '❌ 48h 窗口无任何内容（数据链路疑似中断），未发送，等待备份时点重试。');
  flushSummary();
  console.error('48h 窗口无内容，疑似数据链路故障，退出（备份时点将重试）');
  process.exit(1);
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

const subscribers = db.prepare('SELECT email, token FROM subscribers WHERE confirmed = 1').all();
const targets = retryEmails ? subscribers.filter((s) => retryEmails.has(s.email)) : subscribers;
console.log(`日报内容：${posts.length} 条（${windowH}h），订阅者 ${subscribers.length} 人${retryEmails ? `，本轮补发 ${targets.length} 人` : ''}`);

if (!subscribers.length) {
  console.log('无已确认订阅者，跳过发送');
  summaryLines.push('## 日报邮件', '', `⏭️ 无已确认订阅者，跳过发送（内容 ${posts.length} 条 / ${windowH}h）。`);
  flushSummary();
  process.exit(0);
}
if (!targets.length) {
  console.log('失败名单中的邮箱已退订，无需补发');
  process.exit(0);
}

let sent = 0, failed = 0;
const failedEmails = [];
for (const sub of targets) {
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
    failedEmails.push(sub.email);
    console.warn(`发送失败 ${sub.email}: ${e.message}`);
  }
}
console.log(`日报发送完成：成功 ${sent} / 失败 ${failed}`);

// 记账：累计成功数 + 本轮失败名单（全部失败也记，sent=0 时备份时点全量重试；
// sent>0 且 failed>0 时备份时点按失败名单补发，已送达的不重复打扰）
db.prepare(
  'INSERT OR REPLACE INTO digest_log (sent_date, sent, failed, failed_emails, created_at) VALUES (?, ?, ?, ?, ?)'
).run(dateKey, (already?.sent || 0) + sent, failed, JSON.stringify(failedEmails), new Date().toISOString());
summaryLines.push(
  '## 日报邮件', '',
  `${failed && !sent ? '❌' : '✅'} ${dateStr}：内容 ${posts.length} 条（${windowH}h），订阅者 ${subscribers.length} 人，成功 ${sent} / 失败 ${failed}${retryEmails ? '（补发）' : ''}。`,
  '', `热词：${words.map((w) => w.word || w).join('、') || '-'}`
);
flushSummary();
if (failed && !sent) process.exit(1);
