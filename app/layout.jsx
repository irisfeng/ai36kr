import './globals.css';
import Nav from '@/components/Nav';
import PulseBar from '@/components/PulseBar';

export const metadata = {
  title: '听潮 - AI 行业新闻聚合与社区',
  description: '听潮 TideWire · AI 行业新闻聚合与社区：聚合全网 AI 资讯，观点来自社区。',
};

// viewport-fit=cover：配合安全区 env()，iPhone 刘海/手势条不留白边
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
