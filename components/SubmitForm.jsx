'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES } from '@/lib/categories';

export default function SubmitForm() {
  const router = useRouter();
  const [form, setForm] = useState({ title: '', url: '', category: '大模型', summary: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function submit(e) {
    e.preventDefault();
    if (sending) return;
    setError('');
    setSending(true);
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSending(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/post/${data.id}`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || '提交失败，请稍后再试');
    }
  }

  return (
    <form className="submit-card" onSubmit={submit}>
      {error && <div className="submit-ok" style={{ background: 'var(--hot-soft)', color: 'var(--hot)' }}>{error}</div>}
      <div className="field">
        <label>标题<span className="req">*</span></label>
        <input required maxLength={120} placeholder="一句话说清楚这件事为什么重要" value={form.title} onChange={set('title')} />
      </div>
      <div className="field">
        <label>原文链接</label>
        <input type="url" placeholder="https://…（可选）" value={form.url} onChange={set('url')} />
        <div className="hint">如有来源链接请附上，方便社区溯源。</div>
      </div>
      <div className="field">
        <label>分类<span className="req">*</span></label>
        <select value={form.category} onChange={set('category')}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="field">
        <label>摘要<span className="req">*</span></label>
        <textarea required maxLength={500} placeholder="用几句话说清楚核心信息，社区会基于摘要展开讨论。" value={form.summary} onChange={set('summary')} />
      </div>
      <button className="btn-primary" type="submit" disabled={sending} style={{ padding: '9px 32px' }}>
        {sending ? '提交中…' : '发布到社区'}
      </button>
    </form>
  );
}
