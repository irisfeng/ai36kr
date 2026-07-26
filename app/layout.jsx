import './globals.css';
import Nav from '@/components/Nav';
import PulseBar from '@/components/PulseBar';

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Serif+SC:wght@600;700;900&family=Noto+Sans+SC:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Nav />
        <PulseBar />
        {children}
        <footer className="footer">
          <div className="container footer-inner">
            <span className="f-logo">听潮</span>
            <span>关于听潮 · 聚合全网 AI 资讯，观点来自社区</span>
            <span style={{ marginLeft: 'auto' }}>© 2026 听潮 TideWire</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
