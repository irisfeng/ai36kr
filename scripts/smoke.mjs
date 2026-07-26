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
if (failed) { console.error(`\n${failed} 个页面失败`); process.exit(1); }
console.log(`\n全部 ${pages.length} 个页面通过 @ ${base}`);
