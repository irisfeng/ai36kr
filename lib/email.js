// 邮件发送（Resend）与报纸风模板
// 无 RESEND_API_KEY 时打印到日志（本地开发可用）
import { displayTitle } from './editorial.js';
import { escapeHtml } from './html.js';
import { tracked } from './seo.js';

const FROM = '听潮日报 <daily@mail.shddai.net>';
const SITE = 'https://aikr.shddai.net';

// 欢迎信、日报底部、首页头条下和导航弹层用这一句，不再写「过去 24 小时」
export const DAILY_PROMISE = '北京时间 8 点后，当天这一页送到邮箱。';

// 邮件打开的是首页正在展示的那一页。首页就是当天这一页；当天还空时，首页本身就是滚动窗。
export function editionPageUrl(medium = 'daily') {
  return tracked(`${SITE}/`, 'email', medium);
}

export function dailySubject(edition) {
  return `听潮日报｜${displayTitle(edition?.headline)}`;
}

export async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[听潮] 邮件（无密钥，仅打印）→ ${to} | ${subject}`);
    return { id: 'dev-print' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function shell({ title, body }) {
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F5F3ED;">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;font-family:-apple-system,'PingFang SC','Noto Sans SC',sans-serif;color:#191813;">
    <div style="border-bottom:4px double #191813;padding-bottom:14px;display:flex;align-items:center;gap:10px;">
      <div style="width:34px;height:34px;background:#C23B22;color:#FCFBF7;font-size:20px;font-weight:900;text-align:center;line-height:34px;font-family:'Songti SC',serif;">听</div>
      <div>
        <div style="font-family:'Songti SC',serif;font-weight:900;font-size:22px;letter-spacing:2px;">听潮</div>
        <div style="font-family:Menlo,monospace;font-size:8px;letter-spacing:2.5px;color:#8B8574;">AI NEWS WIRE</div>
      </div>
      <div style="margin-left:auto;font-family:Menlo,monospace;font-size:10px;color:#8B8574;">${safeTitle}</div>
    </div>
    ${body}
    <div style="border-top:1px solid #DCD7C7;margin-top:24px;padding-top:12px;font-size:11px;color:#8B8574;line-height:1.8;">
      听潮 TideWire · 值得看的 AI 新闻 · <a href="${SITE}" style="color:#C23B22;">aikr.shddai.net</a>
    </div>
  </div></body></html>`;
}

export function welcomeEmailHtml({ unsubUrl }) {
  const safeUnsubUrl = escapeHtml(unsubUrl);
  const pageUrl = escapeHtml(editionPageUrl('welcome'));
  return shell({
    title: '订阅成功',
    body: `
    <h1 style="font-family:'Songti SC',serif;font-size:20px;margin:22px 0 10px;">订阅成功</h1>
    <p style="font-size:14px;line-height:1.9;color:#4B463A;">不用点任何确认按钮，这就够了。${escapeHtml(DAILY_PROMISE)}主题就是这一页的头条，一件事只说一次。</p>
    <p style="margin:22px 0;"><a href="${pageUrl}" style="display:inline-block;background:#C23B22;color:#FCFBF7;padding:11px 26px;text-decoration:none;font-size:14px;font-weight:600;">打开当天这一页 →</a></p>
    <p style="font-size:12px;color:#8B8574;line-height:1.8;">如果这不是你本人的操作，<a href="${safeUnsubUrl}" style="color:#8B8574;">点这里立即退订</a>，不会再收到任何邮件。</p>`,
  });
}

// edition: lib/edition.js 的编排结果（headline / highlights / sections / briefs）
export function dailyEmailHtml({ dateStr, edition, unsubUrl, dailyUrl }) {
  const link = (p) => escapeHtml(tracked(`${SITE}/post/${encodeURIComponent(String(p.id))}`, 'email', 'daily'));
  const title = (p) => escapeHtml(displayTitle(p));
  const summary = (p) => {
    const s = p.summary_zh || p.summary || '';
    return s && s !== p.title ? escapeHtml(s) : '';
  };
  const meta = (p) => `${escapeHtml(p.source)}${Number(p.src_count) > 1 ? ` · ${Number(p.src_count)} 家在报` : ''}`;
  const heading = (text) =>
    `<h3 style="font-family:'Songti SC',serif;font-size:15px;margin:24px 0 4px;"><span style="color:#C23B22;">■</span> ${escapeHtml(text)}</h3>`;
  const story = (p, big = false) => `
    <div style="padding:12px 0;border-bottom:1px solid #EDEAE0;">
      <div style="font-family:Menlo,monospace;font-size:10px;color:#8B8574;">${meta(p)}</div>
      <a href="${link(p)}" style="display:block;color:#191813;text-decoration:none;font-family:'Songti SC',serif;font-weight:900;font-size:${big ? 20 : 15}px;line-height:1.5;margin-top:3px;">${title(p)}</a>
      ${summary(p) ? `<div style="font-size:13px;line-height:1.8;color:#4B463A;margin-top:4px;">${summary(p)}</div>` : ''}
    </div>`;

  const { headline, highlights = [], sections = [], briefs = [], total = 0 } = edition;
  const briefLines = briefs.map((p) =>
    `<div style="padding:6px 0;border-bottom:1px solid #EDEAE0;"><a href="${link(p)}" style="color:#4B463A;text-decoration:none;font-size:13px;">${title(p)}</a> <span style="font-family:Menlo,monospace;font-size:10px;color:#8B8574;">${escapeHtml(p.source)}</span></div>`
  ).join('');
  const safeDateStr = escapeHtml(dateStr);
  const safeDailyUrl = escapeHtml(dailyUrl);
  const safeUnsubUrl = escapeHtml(unsubUrl);
  const count = Number(total) || 0;
  // 正文跟网页同一份编排：日历日写「当天」；只有当天还空着、退回滚动窗时才写小时数
  const span = edition.calendar
    ? `当天 ${count} 件事`
    : `过去 ${Number(edition.windowHours) || 24} 小时 ${count} 件事`;

  return shell({
    title: dateStr,
    body: `
    <p style="font-family:Menlo,monospace;font-size:11px;color:#8B8574;margin:16px 0 0;">${safeDateStr} · ${span}，一件事只说一次</p>
    ${headline ? heading('头条') + story(headline, true) : ''}
    ${highlights.length ? heading('看点') + highlights.map((p) => story(p)).join('') : ''}
    ${sections.map(([cat, items]) => heading(cat) + items.map((p) => story(p)).join('')).join('')}
    ${briefLines ? heading('简讯') + briefLines : ''}
    <p style="font-size:13px;line-height:1.8;color:#4B463A;margin:22px 0 0;">${escapeHtml(DAILY_PROMISE)}</p>
    <p style="margin:14px 0 24px;"><a href="${safeDailyUrl}" style="display:inline-block;border:1px solid #191813;color:#191813;padding:10px 24px;text-decoration:none;font-size:13px;">打开当天这一页 →</a></p>
    <p style="font-size:11px;color:#8B8574;">觉得有用就转发给同事。<a href="${safeUnsubUrl}" style="color:#8B8574;">退订日报</a></p>`,
  });
}
