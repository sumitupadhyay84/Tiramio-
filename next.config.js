/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: { formats: ['image/avif', 'image/webp'] },
  async rewrites() {
    const rewrites = [
      { source: '/health', destination: '/api/health' },
      { source: '/menu', destination: '/' },
      { source: '/story', destination: '/' },
      { source: '/reviews', destination: '/' },
      { source: '/track', destination: '/' },
      { source: '/order-smile', destination: '/' },
      { source: '/scan', destination: '/' },
    ];
    // If an external backend is specified, proxy to it
    if (process.env.EXTERNAL_BACKEND_URL) {
      rewrites.push({
        source: '/api/:path*',
        destination: `${process.env.EXTERNAL_BACKEND_URL}/api/:path*`
      });
    }
    return rewrites;
  }
};
module.exports = nextConfig;
