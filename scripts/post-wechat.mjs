// 每天在邮件之后，把同一条头条和首页链接发到公众号。
// 由 .github/workflows/daily-digest.yml 调用。缺密钥则跳过，不在本地当发布命令跑。
// 同一北京日只成功一次：08:13 发出后，09:13 / 10:13 的备份时点不再群发。
import { planWechatPush, sendWechatMassText } from '../lib/wechat-push.js';

const appId = process.env.WECHAT_APP_ID;
const appSecret = process.env.WECHAT_APP_SECRET;
if (!appId || !appSecret) {
  console.log('公众号推送跳过：未配置公众号密钥');
  process.exit(0);
}

const { default: db } = await import('../lib/db.js');
const { loadLatestEdition } = await import('../lib/queries.js');
const edition = loadLatestEdition();
const dateKey = edition.dateKey;
const already = db.prepare('SELECT status FROM wechat_push_log WHERE sent_date = ?').get(dateKey);
const plan = planWechatPush({
  appId, appSecret, edition, alreadySent: already?.status === 'sent',
});
if (plan.action === 'skip') {
  console.log(`公众号推送跳过：${plan.reason}`);
  process.exit(0);
}

try {
  const result = await sendWechatMassText({
    appId, appSecret, text: plan.message.text, clientMsgId: `tidewire-${dateKey}`,
  });
  db.prepare(
    'INSERT OR REPLACE INTO wechat_push_log (sent_date, status, created_at) VALUES (?, ?, ?)'
  ).run(dateKey, 'sent', new Date().toISOString());
  console.log(`公众号已推送：${plan.message.title}${result.msgId ? `（${result.msgId}）` : ''}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
