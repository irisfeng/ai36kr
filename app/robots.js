// 搜索引擎抓取规则
const SITE = 'https://aikr.shddai.net';

export default function robots() {
  return {
    rules: [
      // 明确欢迎 AI 搜索/问答引擎抓取（GEO）：显式声明，避免个别引擎按保守策略跳过
      {
        userAgent: ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Bytespider', 'Google-Extended', 'Amazonbot', 'Meta-ExternalAgent'],
        allow: '/',
        disallow: '/api/',
      },
      { userAgent: '*', allow: '/', disallow: '/api/' },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
