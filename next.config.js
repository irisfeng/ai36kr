/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Next 14 需显式开启，instrumentation.js 的 register() 才会执行
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
