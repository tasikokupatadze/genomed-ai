import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  // Data tables and the prompt are read with fs at runtime; make sure Vercel bundles them.
  outputFileTracingIncludes: {
    "/*": ["./data/**/*", "./prompts/**/*"],
  },
};

export default nextConfig;
