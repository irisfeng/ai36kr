// 交互验证：打开分享卡片 → 等待海报生成 → 截图
import { chromium } from 'playwright-core';

const exe = process.env.CHROME_EXE;
const url = process.argv[2];
const out = process.argv[3] || '/tmp/sharecard-test.png';

const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.click('text=卡片');
await page.waitForSelector('.sharecard');
// 等海报生成（最多 15s），失败也继续看状态
const ok = await page.waitForSelector('.sharecard-poster', { timeout: 15000 }).then(() => true).catch(() => false);
await page.waitForTimeout(800);
await page.screenshot({ path: out });
console.log(ok ? 'POSTER_OK' : 'POSTER_NOT_GENERATED');
if (!ok) {
  const hint = await page.textContent('.sharecard-hint').catch(() => '');
  console.log('hint:', hint);
}
await browser.close();
