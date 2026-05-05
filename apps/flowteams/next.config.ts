import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@axle/pbc-hr-payroll", "@axle/db"],
};

export default nextConfig;
