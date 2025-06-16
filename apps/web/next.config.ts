import type { NextConfig } from "next";

const config: NextConfig = {
  basePath: "/next-eval",
  transpilePackages: [
    "@next-eval/shared",
    "@next-eval/ui",
    "@wordbricks/next-eval",
  ],
};

module.exports = config;
