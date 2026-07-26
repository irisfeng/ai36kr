'use client';

import { useState } from 'react';

// 日报订阅表单：邮箱 → 确认邮件 → 完成
export default function SubscribeForm({ compact = false }) {
  const [email, setEmail] = useState('');
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
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '订阅失败');
      setState('sent');
      setMsg(data.already ? '你已订阅过，日报照常发送 📮' : '确认邮件已发出，点邮件里的按钮完成订阅');
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
      <button type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? '发送中…' : '订阅日报'}
      </button>
      {msg && <span className="subscribe-msg">{msg}</span>}
    </form>
  );
}
