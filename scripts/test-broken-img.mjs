import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.goto(process.argv[2], { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const broken = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.post-card')].find((c) => c.classList.contains('no-cover'));
  return card ? card.querySelector('.post-title')?.textContent?.slice(0, 40) : null;
});
console.log('降级为纯文字卡的条目:', broken ? `OK - ${broken}` : '未找到（可能不在首屏）');
const whiteBoxes = await page.evaluate(() => document.querySelectorAll('.post-card.no-cover .post-cover:not([style*="display: none"])').length);
console.log('残留空白图框:', whiteBoxes);
await page.screenshot({ path: '/tmp/broken-fix.png' });
await browser.close();
