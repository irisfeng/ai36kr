import { WECHAT_MENU } from '../lib/wechat-menu.js';

const appId = process.env.WECHAT_APP_ID;
const appSecret = process.env.WECHAT_APP_SECRET;

if (!appId || !appSecret) {
  console.error('缺少 WECHAT_APP_ID 或 WECHAT_APP_SECRET。');
  process.exit(1);
}

async function readWechatJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    throw new Error(`微信 API 请求失败：HTTP ${response.status}`);
  }
  return body;
}

const tokenUrl = new URL('https://api.weixin.qq.com/cgi-bin/token');
tokenUrl.searchParams.set('grant_type', 'client_credential');
tokenUrl.searchParams.set('appid', appId);
tokenUrl.searchParams.set('secret', appSecret);

const tokenResult = await readWechatJson(tokenUrl);
if (!tokenResult.access_token) {
  throw new Error(`获取 access_token 失败：${tokenResult.errcode || 'UNKNOWN'} ${tokenResult.errmsg || ''}`.trim());
}

const menuUrl = new URL('https://api.weixin.qq.com/cgi-bin/menu/create');
menuUrl.searchParams.set('access_token', tokenResult.access_token);

const menuResult = await readWechatJson(menuUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(WECHAT_MENU),
});

if (menuResult.errcode !== 0) {
  throw new Error(`创建自定义菜单失败：${menuResult.errcode || 'UNKNOWN'} ${menuResult.errmsg || ''}`.trim());
}

console.log('微信菜单同步成功：今日日报 / 本周热榜 / AI快讯');
