export function normalizeExternalHttpUrl(value, { maxLength = 2048 } = {}) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.length > maxLength) return null;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;

  url.hash = '';
  return url.href;
}
