import type { NextConfig } from "next";

const config: NextConfig = {
  basePath: "/next-eval",
  transpilePackages: ["@next-eval/shared", "@ui", "@next-eval/next-eval"],
};

module.exports = config;
