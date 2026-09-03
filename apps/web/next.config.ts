import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@shenicest/shared"],
  async redirects() {
    return [
      {
        source: "/api/:path*",
        destination: "/api-proxy/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
