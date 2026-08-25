//@ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    const apiGatewayUrl =
      process.env.API_GATEWAY_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://api-gateway:3000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiGatewayUrl}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
