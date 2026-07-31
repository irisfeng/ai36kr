// 邮件发送（Resend）与报纸风模板
// 无 RESEND_API_KEY 时打印到日志（本地开发可用）
import { escapeHtml } from './html.js';

const FROM = '听潮日报 <daily@mail.shddai.net>';
const SITE = 'https://aikr.shddai.net';

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
      听潮 TideWire · AI 行业新闻聚合与社区 · <a href="${SITE}" style="color:#C23B22;">aikr.shddai.net</a>
    </div>
  </div></body></html>`;
}

export function confirmEmailHtml({ confirmUrl }) {
  const safeConfirmUrl = escapeHtml(confirmUrl);
  return shell({
    title: '订阅确认',
    body: `
    <h1 style="font-family:'Songti SC',serif;font-size:20px;margin:22px 0 10px;">确认订阅「听潮 · 今日 AI 一页」</h1>
    <p style="font-size:14px;line-height:1.9;color:#4B463A;">每天早上 8 点（北京时间），把过去 24 小时的 AI 圈热词、最受关注 Top3 和分类收录发到你的邮箱。可随时一键退订。</p>
    <p style="margin:22px 0;"><a href="${safeConfirmUrl}" style="display:inline-block;background:#C23B22;color:#FCFBF7;padding:11px 26px;text-decoration:none;font-size:14px;font-weight:600;">确认订阅 →</a></p>
    <p style="font-size:12px;color:#8B8574;">如果按钮无效，复制此链接到浏览器：<br>${safeConfirmUrl}</p>`,
  });
}

export function dailyEmailHtml({ dateStr, words, top3, groups, total, unsubUrl, dailyUrl }) {
  const wordStr = words
    .slice(0, 8)
    .map((w) => `${escapeHtml(w.word)}×${Number(w.count) || 0}`)
    .join(' · ');
  const top = top3.map((p, i) => `
    <div style="border:1px solid #DCD7C7;padding:12px 14px;margin:8px 0;background:#FCFBF7;">
      <span style="display:inline-block;width:20px;height:20px;text-align:center;line-height:20px;font-family:Menlo,monospace;font-size:11px;color:#FCFBF7;background:${i === 0 ? '#C23B22' : i === 1 ? '#191813' : '#8B8574'};">${i + 1}</span>
      <a href="${SITE}/post/${encodeURIComponent(String(p.id))}" style="color:#191813;text-decoration:none;font-family:'Songti SC',serif;font-weight:900;font-size:15px;margin-left:8px;">${escapeHtml(p.title_zh || p.title)}</a>
      <div style="font-size:11px;color:#8B8574;margin-top:4px;font-family:Menlo,monospace;">${escapeHtml(p.source)} · ▲${(Number(p.up) || 0) - (Number(p.down) || 0)}</div>
    </div>`).join('');
  const cats = groups.map(([cat, items]) => {
    const lines = items.slice(0, 5).map((p) =>
      `<div style="padding:7px 0;border-bottom:1px solid #EDEAE0;"><a href="${SITE}/post/${encodeURIComponent(String(p.id))}" style="color:#4B463A;text-decoration:none;font-size:13px;">${escapeHtml(p.title_zh || p.title)}</a></div>`
    ).join('');
    return `<h3 style="font-family:'Songti SC',serif;font-size:15px;margin:18px 0 6px;"><span style="color:#C23B22;">■</span> ${escapeHtml(cat)} <span style="font-size:11px;color:#8B8574;font-weight:400;">${items.length}</span></h3>${lines}`;
  }).join('');
  const safeDateStr = escapeHtml(dateStr);
  const safeDailyUrl = escapeHtml(dailyUrl);
  const safeUnsubUrl = escapeHtml(unsubUrl);

  return shell({
    title: dateStr,
    body: `
    <p style="font-family:Menlo,monospace;font-size:11px;color:#8B8574;margin:16px 0 4px;">${safeDateStr} · 24 小时收录 ${Number(total) || 0} 条</p>
    <p style="font-size:13px;color:#4B463A;margin:0 0 14px;">热词：${wordStr || '统计中'}</p>
    <h3 style="font-family:'Songti SC',serif;font-size:16px;margin:16px 0 8px;"><span style="color:#C23B22;">■</span> 今日最受关注</h3>
    ${top}
    ${cats}
    <p style="margin:22px 0;"><a href="${safeDailyUrl}" style="display:inline-block;border:1px solid #191813;color:#191813;padding:10px 24px;text-decoration:none;font-size:13px;">打开完整今日一页 →</a>
    <a href="${SITE}/daily-card.html" style="display:inline-block;margin-left:10px;border:1px solid #C23B22;color:#C23B22;padding:10px 24px;text-decoration:none;font-size:13px;">今日头条海报 ↗</a></p>
    <div style="border:1px dashed #C23B22;padding:12px 14px;margin:20px 0;background:#FCFBF7;">
      <div style="font-size:13px;font-weight:600;color:#191813;">觉得今天的日报有用？</div>
      <div style="font-size:12px;color:#4B463A;line-height:1.8;margin-top:4px;">转发给需要的同事朋友，就是最大的支持。订阅只需一个邮箱，每天 8 点送达：<a href="${SITE}/daily" style="color:#C23B22;text-decoration:none;">aikr.shddai.net/daily</a></div>
    </div>
    <p style="font-size:11px;color:#8B8574;"><a href="${safeUnsubUrl}" style="color:#8B8574;">退订日报</a></p>`,
  });
}
