import type { NextConfig } from "next";

// GitHub Pages のようにサブパス配下で公開する場合に指定する (例: "/zouhai-kabu-screener")。
// Cloudflare Pages / Netlify / Vercel などルート直下で公開する場合は未設定でよい。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  // サーバーもDBも不要な静的サイトとして書き出す
  output: "export",
  basePath,
  images: { unoptimized: true },
  // 静的ホスティングで /stocks/1414 のようなURLをそのまま開けるようにする
  trailingSlash: true,
};

export default nextConfig;
