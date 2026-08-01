// 全页冒烟：node scripts/smoke.mjs [baseUrl]
// 默认打本地 3000；上线后建议再跑一遍 https://aikr.shddai.net
const base = process.argv[2] || 'http://localhost:3000';
const pages = ['/', '/daily', '/flashes', '/launch', '/submit', '/rss.xml', '/sitemap.xml', '/robots.txt'];

let postId = null;
try {
  const d = await (await fetch(`${base}/api/posts?sort=new&limit=1`)).json();
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
const assertions = [
  ['首页含文章卡片', home.includes('post-card')],
  ['首页非空结果占位', !home.includes('没有找到相关内容')],
];
const pulse = await (await fetch(`${base}/api/pulse`)).json().catch(() => null);
assertions.push(['脉搏有在线源', !!pulse && pulse.sources?.some((s) => s.ok)]);
for (const [label, ok] of assertions) {
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} 断言:${label}`);
}
if (failed) { console.error(`\n${failed} 项失败（含内容断言）`); process.exit(1); }
console.log(`\n全部 ${pages.length} 个页面 + ${assertions.length} 项内容断言通过 @ ${base}`);
