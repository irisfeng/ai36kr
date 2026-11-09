import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import Nav from '@/components/Nav';
import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN, jsonLdScript, siteGraph } from '@/lib/seo';

const HOME_TITLE = `${SITE_NAME} - 值得看的 AI 新闻，一件事只说一次`;

export const metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: HOME_TITLE,
    template: `%s - ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: ['AI新闻', 'AI日报', 'AI精选', '人工智能资讯', '大模型', 'AI热点'],
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: HOME_TITLE,
    description: SITE_DESCRIPTION,
    locale: 'zh_CN',
    url: '/',
    images: ['/og-cover.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_TITLE,
    description: SITE_DESCRIPTION,
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

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 中文字体全走系统栈（Songti SC/SimSun/Noto Serif CJK），零下载、零阻塞、LCP 即时；
            不引 Google Fonts（CJK 网页字体 CSS 阻塞渲染 + 字体交换延迟是 LCP 主因） */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(siteGraph()) }} />
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
            <a href="/about">编辑方法</a>
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
