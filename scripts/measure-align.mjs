import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
// 弹层里的表单
await page.click('.nav-subscribe');
await page.waitForSelector('.subscribe-modal');
const m = await page.evaluate(() => {
  const i = document.querySelector('.subscribe-modal .subscribe-form input').getBoundingClientRect();
  const b = document.querySelector('.subscribe-modal .subscribe-form button').getBoundingClientRect();
  return { input: { h: i.height, top: i.top }, button: { h: b.height, top: b.top } };
});
console.log('input :', m.input.h, 'top', m.input.top);
console.log('button:', m.button.h, 'top', m.button.top);
console.log(Math.abs(m.input.h - m.button.h) < 0.5 && Math.abs(m.input.top - m.button.top) < 0.5 ? '等高对齐 ✓' : '仍不齐 ✗');
await page.screenshot({ path: '/tmp/sub-modal2.png' });
await browser.close();
