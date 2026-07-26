import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXE });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.click('.nav-subscribe');
await page.waitForSelector('.subscribe-modal');
const out = await page.evaluate(() => {
  const pick = (el) => {
    const cs = getComputedStyle(el);
    return { margin: cs.margin, alignSelf: cs.alignSelf, transform: cs.transform, display: cs.display, verticalAlign: cs.verticalAlign };
  };
  const form = document.querySelector('.subscribe-modal .subscribe-form');
  return {
    form: { display: getComputedStyle(form).display, alignItems: getComputedStyle(form).alignItems, flexWrap: getComputedStyle(form).flexWrap },
    input: pick(form.querySelector('input')),
    button: pick(form.querySelector('button')),
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
