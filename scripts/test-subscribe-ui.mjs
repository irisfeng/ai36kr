// 交互验证：订阅弹层 + 侧栏订阅卡
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: process.env.CHROME_EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.goto(process.argv[2] || 'http://localhost:3000', { waitUntil: 'networkidle' });

// 侧栏订阅卡
const sideCard = await page.$('.side-subscribe');
console.log('侧栏订阅卡:', sideCard ? 'OK' : 'MISSING');

// 导航订阅弹层
await page.click('.nav-subscribe');
await page.waitForSelector('.subscribe-modal');
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/sub-modal.png' });
console.log('订阅弹层: OK');

// 弹层内订阅表单可用
await page.fill('.subscribe-modal input[type="email"]', 'ui-test@example.com');
console.log('表单可输入: OK');

await page.click('.modal-mask', { position: { x: 8, y: 8 } });
await page.waitForSelector('.subscribe-modal', { state: 'detached' });
console.log('弹层可关闭: OK');

// 整页截图（含侧栏卡片）
await page.screenshot({ path: '/tmp/sub-page.png' });
await browser.close();
