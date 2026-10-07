// 日报的分享预览图（og:image）：1200×630 PNG，X / 微信 / Telegram 贴链接时显示。
// 文章页的分享海报是 SVG（app/api/sharecard），这些平台不认 SVG 预览，所以这里出位图。
// 内容与日报页同一份编排：头条 + 三条看点。
import { ImageResponse } from 'next/og';
import { editionDays, loadEdition, loadLatestEdition } from '@/lib/queries';
import { beijingDateKey, beijingDayRange } from '@/lib/time';
import { consumeRequestRateLimit } from '@/lib/rate-limit';
import { rateLimitExceeded } from '@/lib/write-response';

export const dynamic = 'force-dynamic';

const W = 1200, H = 630, PAD = 56;
const PAPER = '#F5F3ED', INK = '#191813', INK_2 = '#4B463A', INK_3 = '#8B8574', RED = '#C23B22';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// 每次请求要读库并渲染位图，按 IP 30 次/分钟；正常流量由 CDN 缓存挡掉
const OG_LIMIT = { scope: 'og-daily', limit: 30, windowMs: 60 * 1000 };

const titleOf = (p) => (p.title_zh || p.title || '').replace(/\s+/g, ' ').trim();
// 按显示宽度截断：中文算 1，ASCII 算 0.55
function clip(text, max) {
  let w = 0, out = '';
  for (const ch of text) {
    w += ch.codePointAt(0) > 0x2e7f ? 1 : 0.55;
    if (w > max) return `${out.trimEnd()}…`;
    out += ch;
  }
  return out;
}

export async function GET(request, ctx) {
  const requestLimit = consumeRequestRateLimit(request, OG_LIMIT);
  if (!requestLimit.allowed) return rateLimitExceeded(requestLimit);
  const { date } = await ctx.params;
  if (!DATE_RE.test(date)) return new Response('bad date', { status: 400 });

  // 今天的图跟 /daily 一样取最近 24 小时；过去的日子取那一个北京日历日
  const isToday = date === beijingDateKey(new Date().toISOString());
  if (!isToday && !editionDays().includes(date)) return new Response('not found', { status: 404 });
  const edition = isToday ? loadLatestEdition() : loadEdition(beijingDayRange(date));
  if (!edition.headline) return new Response('not found', { status: 404 });

  const [y, m, d] = date.split('-').map(Number);
  const headline = clip(titleOf(edition.headline), 54);
  const highlights = edition.highlights.slice(0, 3).map((p) => clip(titleOf(p), 38));

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', background: PAPER, color: INK, padding: `40px ${PAD}px 36px` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', width: 54, height: 54, background: RED, color: '#FCFBF7', fontSize: 34, fontWeight: 700, alignItems: 'center', justifyContent: 'center' }}>听</div>
            <div style={{ display: 'flex', marginLeft: 16, fontSize: 40, fontWeight: 700, letterSpacing: 4 }}>听潮日报</div>
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: INK_3 }}>{`${y} 年 ${m} 月 ${d} 日`}</div>
        </div>
        <div style={{ display: 'flex', height: 1, background: INK, marginTop: 22 }} />
        <div style={{ display: 'flex', height: 4, background: INK, marginTop: 4 }} />

        <div style={{ display: 'flex', alignItems: 'center', marginTop: 30, fontSize: 22, color: RED, fontWeight: 700, letterSpacing: 3 }}>
          <div style={{ display: 'flex', width: 12, height: 12, background: RED, marginRight: 12 }} />
          头条
        </div>
        <div style={{ display: 'flex', marginTop: 12, fontSize: 54, fontWeight: 700, lineHeight: 1.32 }}>{headline}</div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto' }}>
          {highlights.map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', fontSize: 26, color: INK_2, borderTop: '1px solid #DCD7C7', padding: '11px 0' }}>
              <div style={{ display: 'flex', width: 8, height: 8, background: INK_3, marginRight: 14 }} />
              {t}
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${INK}`, paddingTop: 14, fontSize: 20, color: INK_3 }}>
            <div style={{ display: 'flex' }}>{`${edition.total} 件事，选出 ${edition.main.length} 条 · 一件事只说一次`}</div>
            <div style={{ display: 'flex' }}>aikr.shddai.net</div>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: {
        // 过去的日报不再变；今天的随聚合更新
        'Cache-Control': isToday ? 'public, max-age=300, s-maxage=600' : 'public, max-age=3600, s-maxage=86400',
      },
    },
  );
}
