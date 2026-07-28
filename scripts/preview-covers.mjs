import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXE });
const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
const ids = [11, 22, 33, 44, 55, 66];
await page.setContent(`<body style="margin:0;background:#EDEAE0;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px">${ids.map(i=>`<img src="http://localhost:3000/api/cover/${i}.svg" style="width:100%;aspect-ratio:21/9"/>`).join('')}</body>`);
await page.waitForTimeout(1200);
await page.screenshot({ path: '/tmp/tide-covers.png' });
await browser.close();
