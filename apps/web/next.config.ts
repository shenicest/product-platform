import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@shenicest/shared"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "/api-proxy/:path*",
      },
    ];
  },
};

export default nextConfig;
