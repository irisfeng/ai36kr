import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import Nav from '@/components/Nav';

export const metadata = {
  metadataBase: new URL('https://aikr.shddai.net'),
  title: {
    default: '听潮 TideWire - 值得看的 AI 新闻，一件事只说一次',
    template: '%s - 听潮 TideWire',
  },
  description: '听潮 TideWire：每天从 33 个信源里挑出值得看的 AI 新闻。同一件事只说一次，官方一手优先，英文内容译成中文，每日 8 点出日报。',
  keywords: ['AI新闻', 'AI日报', 'AI精选', '人工智能资讯', '大模型', 'AI热点'],
  openGraph: {
    type: 'website',
    siteName: '听潮 TideWire',
    title: '听潮 TideWire - 值得看的 AI 新闻，一件事只说一次',
    description: '每天从 33 个信源里挑出值得看的 AI 新闻。同一件事只说一次，每日 8 点出日报。',
    locale: 'zh_CN',
    images: ['/og-cover.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: '听潮 TideWire - 值得看的 AI 新闻，一件事只说一次',
    description: '每天从 33 个信源里挑出值得看的 AI 新闻。同一件事只说一次，每日 8 点出日报。',
    images: ['/og-cover.png'],
  },
  alternates: {
    types: { 'application/rss+xml': '/rss.xml' },
  },
  manifest: '/manifest.json',
  verification: { other: { 'baidu-site-verification': 'codeva-4qy8UC7zsF' } },
};

// viewport-fit=cover：配合安全区 env()，iPhone 刘海/手势条不留白边
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F5F3ED',
};

// SEO/GEO：WebSite 结构化数据（声明站点实体 + 站内搜索动作）
const SITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: '听潮 TideWire',
  alternateName: '听潮',
  url: 'https://aikr.shddai.net',
  description: '听潮 TideWire：每天从 33 个信源里挑出值得看的 AI 新闻。同一件事只说一次，官方一手优先，英文内容译成中文，每日 8 点出日报。',
  inLanguage: 'zh-CN',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: 'https://aikr.shddai.net/all?q={search_term_string}' },
    'query-input': 'required name=search_term_string',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 中文字体全走系统栈（Songti SC/SimSun/Noto Serif CJK），零下载、零阻塞、LCP 即时；
            不引 Google Fonts（CJK 网页字体 CSS 阻塞渲染 + 字体交换延迟是 LCP 主因） */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSONLD).replace(/</g, '\\u003c') }} />
      </head>
      <body>
        <div className="site-header">
          <Nav />
        </div>
        {children}
        <footer className="footer">
          <div className="container footer-inner">
            <span className="f-logo">听潮</span>
            <span>值得看的 AI 新闻，一件事只说一次</span>
            <a href="/rss.xml">RSS</a>
            <a href="/llms.txt">llms.txt</a>
            <a className="f-note" href="https://mp.weixin.qq.com/s/GDvzQTFpTSTuBOTEfj5djg" target="_blank" rel="noopener noreferrer">
              手记 · 一个人，和一台不会替你负责的机器 ↗
            </a>
            <span className="f-copy">© 2026 听潮 TideWire</span>
          </div>
        </footer>
        {/* 访问统计：不用 cookie；只在 Vercel 上生效，要在项目的 Analytics 页里开启 */}
        <Analytics />
      </body>
    </html>
  );
}
