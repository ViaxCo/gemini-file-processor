import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove the output export mode to allow for dynamic rendering
  // output: 'export',
  
  // Set custom dist directory to maintain build output location
  distDir: 'dist',
  
  // Enable React 19 features
  reactStrictMode: true,
  
  // Environment variables will be handled via .env files
  env: {},
};

export default nextConfig;