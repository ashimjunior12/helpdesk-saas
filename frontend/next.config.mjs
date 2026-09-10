/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a minimal self-contained server bundle for small production images.
  output: 'standalone',
};

export default nextConfig;
