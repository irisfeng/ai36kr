/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
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
