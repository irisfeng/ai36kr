// 全页冒烟：node scripts/smoke.mjs [baseUrl]
// 默认打本地 3000；上线后建议再跑一遍 https://aikr.shddai.net
const base = process.argv[2] || 'http://localhost:3000';
const pages = ['/', '/hot', '/daily', '/all', '/about', '/rss.xml', '/sitemap.xml', '/robots.txt', '/llms.txt'];

let postId = null;
try {
  const d = await (await fetch(`${base}/api/posts?sort=all&limit=1`)).json();
  postId = (Array.isArray(d) ? d : d.posts)?.[0]?.id;
} catch { /* 忽略 */ }
if (postId) pages.push(`/post/${postId}`);

let failed = 0;
for (const p of pages) {
  try {
    const res = await fetch(`${base}${p}`, { redirect: 'follow' });
    const ok = res.status === 200;
    if (!ok) failed++;
    console.log(`${ok ? '✓' : '✗'} ${res.status} ${p}`);
  } catch (e) {
    failed++;
    console.log(`✗ ERR ${p} ${e.message}`);
  }
}

// 内容级断言：HTTP 200 不等于页面有料（构建期空库预渲染空首页的教训）
const home = await (await fetch(`${base}/`)).text();
const picks = await (await fetch(`${base}/api/posts?sort=pick&limit=5`)).json().catch(() => null);
const hot = await (await fetch(`${base}/hot`)).text();
const daily = await (await fetch(`${base}/daily`)).text();
const about = await (await fetch(`${base}/about`)).text();
const robots = await (await fetch(`${base}/robots.txt`)).text();
const postHtml = postId ? await (await fetch(`${base}/post/${postId}`)).text() : '';
const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const search = await fetch(`${base}/all?q=openai`);
const searchHtml = await search.text();
const apiHeaders = await fetch(`${base}/api/posts?limit=1`);
const oneH1 = (html) => (html.match(/<h1[\s>]/g) || []).length === 1;
const canonical = (html) => html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || '';
const titleOf = (html) => html.match(/<title>([^<]*)<\/title>/)?.[1] || '';
const trainingBlock = robots.split(/\n\n+/).find((block) => block.includes('User-Agent: GPTBot')) || '';
const assertions = [
  ['首页含新闻条目', home.includes('class="story')],
  ['首页非空占位', !home.includes('正在抓取第一批内容')],
  // 精选为空 = 排序环节没跑起来（或门槛高到什么都选不上）
  ['精选接口有内容', Array.isArray(picks) && picks.length > 0],
  ['首页只有一个 H1', oneH1(home) && home.includes('值得看的 AI 新闻，一件事只说一次')],
  ['首页 canonical', canonical(home) === 'https://aikr.shddai.net'],
  ['热点标题写明 AI', titleOf(hot).includes('AI 热点') && oneH1(hot)],
  ['热点 canonical', canonical(hot) === 'https://aikr.shddai.net/hot'],
  ['日报标题写明 AI 日报', titleOf(daily).includes('AI 日报') && oneH1(daily)],
  ['日报 canonical', canonical(daily) === 'https://aikr.shddai.net/daily'],
  ['编辑方法可打开', about.includes('编辑方法') && about.includes('OpenAI') && about.includes('不是原文全文')],
  ['编辑方法 canonical', canonical(about) === 'https://aikr.shddai.net/about'],
  ['训练爬虫不放行 OG', trainingBlock.includes('Disallow: /api/') && !trainingBlock.includes('/api/og/')],
  ['搜索爬虫可抓 OG', robots.includes('Allow: /api/og/')],
  ['站点地图不用当天 23:59 充 lastmod', !sitemap.includes('T15:59:59') && sitemap.includes('<lastmod>')],
  ['搜索页 noindex', searchHtml.includes('name="robots" content="noindex, follow"') || searchHtml.includes('noindex, follow')],
  ['接口 noindex', (apiHeaders.headers.get('x-robots-tag') || '').includes('noindex')],
  ['文章页有原文、摘要说明和 NewsArticle', !postId || (
    oneH1(postHtml)
    && postHtml.includes('阅读原文')
    && postHtml.includes('不是原文全文')
    && postHtml.includes('"@type":"NewsArticle"')
    && canonical(postHtml) === `https://aikr.shddai.net/post/${postId}`
  )],
];
for (const [label, ok] of assertions) {
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} 断言:${label}`);
}
if (failed) { console.error(`\n${failed} 项失败（含内容断言）`); process.exit(1); }
console.log(`\n全部 ${pages.length} 个页面 + ${assertions.length} 项内容断言通过 @ ${base}`);
