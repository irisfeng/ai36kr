import './globals.css';
import Nav from '@/components/Nav';
import PulseBar from '@/components/PulseBar';
import SubscribeForm from '@/components/SubscribeForm';

export const metadata = {
  metadataBase: new URL('https://aikr.shddai.net'),
  title: {
    default: '听潮 TideWire - AI 行业新闻聚合与社区',
    template: '%s - 听潮 TideWire',
  },
  description: '听潮 TideWire · AI 行业新闻聚合与社区：聚合 37 个真实信息源，每 30 分钟更新。AI 新闻、快讯、新品、深度长读，观点来自社区。',
  keywords: ['AI新闻', 'AI聚合', '人工智能资讯', 'AI快讯', '大模型', 'AI新品'],
  openGraph: {
    type: 'website',
    siteName: '听潮 TideWire',
    title: '听潮 TideWire - AI 行业新闻聚合与社区',
    description: '聚合 37 个真实信息源，每 30 分钟更新。AI 新闻、快讯、新品、深度长读。',
    locale: 'zh_CN',
    images: ['/og-cover.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: '听潮 TideWire - AI 行业新闻聚合与社区',
    description: '聚合 37 个真实信息源，每 30 分钟更新。AI 新闻、快讯、新品、深度长读。',
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
  description: '中文 AI 行业新闻聚合与社区：聚合 37 个真实信息源，每 30 分钟更新，英文内容自动译为中文。',
  inLanguage: 'zh-CN',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: 'https://aikr.shddai.net/?q={search_term_string}' },
    'query-input': 'required name=search_term_string',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 中文字体全走系统栈（Songti SC/SimSun/Noto Serif CJK），零下载、零阻塞、LCP 即时；
            不引 Google Fonts（CJK 网页字体 CSS 阻塞渲染 + 字体交换延迟是 LCP 主因） */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSONLD) }} />
      </head>
      <body>
        <Nav />
        <PulseBar />
        {children}
        <footer className="footer">
          <div className="container footer-inner">
            <span className="f-logo">听潮</span>
            <span>关于听潮 · 聚合全网 AI 资讯，观点来自社区</span>
            <a className="f-note" href="https://mp.weixin.qq.com/s/GDvzQTFpTSTuBOTEfj5djg" target="_blank" rel="noopener noreferrer">
              手记 · 一个人，和一台不会替你负责的机器 ↗
            </a>
            <span className="footer-subscribe">
              <SubscribeForm compact />
            </span>
            <span>© 2026 听潮 TideWire</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
