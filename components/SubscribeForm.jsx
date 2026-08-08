'use client';

import { useState } from 'react';

// 日报订阅表单：填邮箱即订阅（single opt-in），欢迎信内附一键退订
export default function SubscribeForm({ compact = false }) {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // 蜜罐：人类不可见，机器人会填
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [msg, setMsg] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    setMsg('');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '订阅失败');
      setState('sent');
      setMsg(data.already ? '你已订阅过，日报照常发送 📮' : '订阅成功，明早 8 点见 📮');
    } catch (err) {
      setState('error');
      setMsg(err.message);
    }
  }

  if (state === 'sent') {
    return <p className="subscribe-done">{msg}</p>;
  }

  return (
    <form className={`subscribe-form${compact ? ' compact' : ''}`} onSubmit={submit}>
      <input
        type="email"
        required
        placeholder="你的邮箱"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label="订阅邮箱"
      />
      {/* 蜜罐字段：用 CSS 藏到视口外，真人永远填不到；机器人填了服务端直接丢弃 */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />
      <button type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? '发送中…' : '订阅日报'}
      </button>
      {msg && <span className="subscribe-msg">{msg}</span>}
    </form>
  );
}
