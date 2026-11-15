// 公众号每天一条主动推送：和邮件同一份编排、同一条头条，打开首页。
// 群发接口要 AppID 和 AppSecret。缺密钥时由调用方跳过，不在这里假装发出去。
import { displayTitle } from './editorial.js';

const DEFAULT_SITE = 'https://aikr.shddai.net';

function pageUrl(siteUrl) {
  const url = new URL('/', siteUrl || DEFAULT_SITE);
  url.searchParams.set('utm_source', 'wechat');
  url.searchParams.set('utm_medium', 'official_account');
  url.searchParams.set('utm_campaign', 'daily');
  return url.toString();
}

// 主题与邮件相同：听潮日报｜头条。链接是首页，首页就是当天这一页。
export function wechatDailyMessage(edition, siteUrl = DEFAULT_SITE) {
  if (!edition?.headline) return null;
  const title = `听潮日报｜${displayTitle(edition.headline)}`;
  const url = pageUrl(siteUrl);
  return { title, url, text: `${title}\n${url}` };
}

export function planWechatPush({ appId, appSecret, edition, alreadySent }) {
  if (!appId || !appSecret) return { action: 'skip', reason: '未配置公众号密钥' };
  if (alreadySent) return { action: 'skip', reason: '今日已推送' };
  const message = wechatDailyMessage(edition);
  if (!message) return { action: 'skip', reason: '当天没有头条' };
  return { action: 'send', message };
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// 群发一条文字。错误信息只带错误码，不带回密钥或 token。
export async function sendWechatMassText({
  appId, appSecret, text, clientMsgId, fetchImpl = fetch,
}) {
  const tokenUrl = new URL('https://api.weixin.qq.com/cgi-bin/token');
  tokenUrl.searchParams.set('grant_type', 'client_credential');
  tokenUrl.searchParams.set('appid', appId);
  tokenUrl.searchParams.set('secret', appSecret);
  let tokenBody;
  try {
    tokenBody = await readJson(await fetchImpl(tokenUrl));
  } catch {
    throw new Error('获取 access_token 失败');
  }
  if (!tokenBody?.access_token) {
    throw new Error(`获取 access_token 失败：${tokenBody?.errcode || 'UNKNOWN'}`);
  }
  const sendUrl = new URL('https://api.weixin.qq.com/cgi-bin/message/mass/sendall');
  sendUrl.searchParams.set('access_token', tokenBody.access_token);
  let body;
  try {
    body = await readJson(await fetchImpl(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        filter: { is_to_all: true },
        text: { content: text },
        msgtype: 'text',
        clientmsgid: clientMsgId,
      }),
    }));
  } catch {
    throw new Error('群发失败');
  }
  if (!body || body.errcode) throw new Error(`群发失败：${body?.errcode || 'UNKNOWN'}`);
  return { msgId: body.msg_id ?? null };
}
