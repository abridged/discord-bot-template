/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Configure the source directory for Next.js
  distDir: '.next',
  // Set the base path for your application
  basePath: '',
  // Configure the source directory for pages
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
}

module.exports = nextConfig
