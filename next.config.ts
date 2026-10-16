import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 에이전트 규칙은 .agents/AGENTS.md에서 직접 관리한다. next dev가 루트 AGENTS.md를 다시 쓰지 않게 끈다.
  agentRules: false,
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
