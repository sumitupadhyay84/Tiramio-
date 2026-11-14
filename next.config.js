/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: { formats: ['image/avif', 'image/webp'] },
  async rewrites() {
    return [
      { source: '/menu', destination: '/' },
      { source: '/story', destination: '/' },
      { source: '/track', destination: '/' },
      { source: '/order-smile', destination: '/' },
      { source: '/scan', destination: '/' },
    ];
  }
};
module.exports = nextConfig;
