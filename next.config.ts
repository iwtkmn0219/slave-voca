import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // pdf.js는 번들링하지 않고 Node에서 그대로 불러온다.
  serverExternalPackages: ["pdfjs-dist"],
  experimental: {
    serverActions: {
      // PDF 50MB + multipart 오버헤드
      bodySizeLimit: "51mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
