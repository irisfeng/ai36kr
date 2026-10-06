// 进程内 TTL 缓存：serverless 暖实例跨请求复用，挡掉对远端 Turso 的重复往返。
// 数据在最坏情况下陈旧一个 TTL（30~60s）——新闻聚合站可接受。
const store = new Map();
const MAX_ENTRIES = 500;

export function cached(key, ttlMs, fn, now = Date.now()) {
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value;
  const value = fn();
  store.set(key, { value, expires: now + ttlMs });
  if (store.size > MAX_ENTRIES) {
    for (const [k, v] of store) if (v.expires <= now) store.delete(k);
    // 全未过期时淘汰最旧写入，防内存膨胀
    while (store.size > MAX_ENTRIES * 0.9) store.delete(store.keys().next().value);
  }
  return value;
}

// 指定前缀的缓存即刻失效（排序环节写库后调用；跨实例的过期由 TTL 兜底）
export function bustCache(prefix = '') {
  if (!prefix) { store.clear(); return; }
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
