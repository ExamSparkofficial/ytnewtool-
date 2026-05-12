import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Linting is handled explicitly via `npm run lint`, which avoids
    // version-specific issues inside Next's build-time lint wrapper.
    ignoreDuringBuilds: true
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  },
  outputFileTracingIncludes: {
    "/api/video": ["./node_modules/ffmpeg-static/**/*"],
    "/api/voices": ["./node_modules/ffmpeg-static/**/*"]
  }
};

export default nextConfig;
