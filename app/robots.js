// 搜索引擎抓取规则
const SITE = 'https://aikr.shddai.net';

export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
