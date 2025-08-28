/** @type {import('next').NextConfig} */
const nextConfig = {
  // Set custom dist directory to maintain build output location
  distDir: 'dist',
  
  // Enable React 19 features and optimizations
  reactStrictMode: true,
  
  // Optimize bundle size and performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  
  // Enable compression and optimizations
  compress: true,
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;