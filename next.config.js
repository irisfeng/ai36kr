/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // 已下线的页面：别让收藏夹和搜索引擎里的旧链接变成 404
  async redirects() {
    return [
      { source: '/weekly', destination: '/hot', permanent: true },
      { source: '/flashes', destination: '/all', permanent: true },
      { source: '/launch', destination: '/', permanent: true },
      { source: '/submit', destination: '/', permanent: true },
      { source: '/word/:word', destination: '/all?q=:word', permanent: true },
    ];
  },
  // 全站安全响应头（路由级同名头优先，如 /api/img 的 CORP/CSP）
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
