import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@axle/ui", "@axle/auth", "@axle/db"],
};

export default nextConfig;
