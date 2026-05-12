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
    "/api/video": [
      "./node_modules/ffmpeg-static/**/*",
      "./node_modules/@ffmpeg-installer/ffmpeg/**/*",
      "./node_modules/@ffmpeg-installer/linux-x64/**/*"
    ],
    "/api/voices": [
      "./node_modules/ffmpeg-static/**/*",
      "./node_modules/@ffmpeg-installer/ffmpeg/**/*",
      "./node_modules/@ffmpeg-installer/linux-x64/**/*"
    ]
  }
};

export default nextConfig;
