import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for optimized Docker builds
  // This creates a minimal server.js file with all dependencies
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  
  // Optimize images for production
  images: {
    unoptimized: false,
  },
};

export default nextConfig;
