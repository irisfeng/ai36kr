// SEO 主动推送：把近 24h 新帖 URL 推给 百度主动推送 + IndexNow（Bing 等）
// 用法：node scripts/push-urls.mjs（CI daily-digest.yml 调用；密钥缺失自动跳过对应通道）
// - 百度主动推送：需 BAIDU_PUSH_TOKEN（百度搜索资源平台 ziyuan.baidu.com 验证站点后获取）
// - IndexNow：无需 secret——密钥即仓库内 public/<key>.txt（按规范必须可公开访问）
import fs from 'node:fs';
import path from 'node:path';
import db from '../lib/db.js';

const SITE = 'https://aikr.shddai.net';
const MAX_URLS = 50; // 百度新站配额有限（通常 ~30/天），只推最新的

const rows = db.prepare(
  `SELECT id FROM posts WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?`
).all(new Date(Date.now() - 24 * 3600000).toISOString(), MAX_URLS);
const urls = rows.map((r) => `${SITE}/post/${r.id}`);
console.log(`待推送 URL：${urls.length} 条（近 24h）`);
if (!urls.length) process.exit(0);

// ---- 百度主动推送 ----
async function pushBaidu() {
  const token = process.env.BAIDU_PUSH_TOKEN;
  if (!token) {
    console.log('百度：未配置 BAIDU_PUSH_TOKEN，跳过');
    return;
  }
  try {
    const res = await fetch(`http://data.zz.baidu.com/urls?site=${encodeURIComponent(SITE)}&token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: urls.join('\n'),
    });
    const text = await res.text();
    console.log(`百度：HTTP ${res.status} ${text.slice(0, 200)}`);
  } catch (e) {
    console.warn(`百度推送失败（不影响其他通道）: ${e.message}`);
  }
}

// ---- IndexNow（Bing / Yandex / Naver 等）----
async function pushIndexNow() {
  let key = '';
  try {
    const pubDir = path.join(process.cwd(), 'public');
    key = fs.readdirSync(pubDir).find((f) => /^[0-9a-f]{32}\.txt$/.test(f))?.slice(0, 32) || '';
    if (key && fs.readFileSync(path.join(pubDir, `${key}.txt`), 'utf8').trim() !== key) key = '';
  } catch { /* 无 public 目录 */ }
  if (!key) {
    console.log('IndexNow：public/ 下未找到密钥文件，跳过');
    return;
  }
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'aikr.shddai.net',
        key,
        keyLocation: `${SITE}/${key}.txt`,
        urlList: urls,
      }),
    });
    console.log(`IndexNow：HTTP ${res.status}（200/202 即受理）`);
  } catch (e) {
    console.warn(`IndexNow 推送失败（不影响其他通道）: ${e.message}`);
  }
}

await pushBaidu();
await pushIndexNow();
