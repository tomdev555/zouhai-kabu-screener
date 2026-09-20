import type { NextConfig } from "next";
import path from "path";

// GitHub Pages のようにサブパス配下で公開する場合に指定する (例: "/zouhai-kabu-screener")。
// Cloudflare Pages / Netlify / Vercel などルート直下で公開する場合は未設定でよい。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// 個人モード (.env.local に PERSONAL_MODE=1)。
// - 通常のNext.jsサーバーとして動き、SQLiteに保存する自分専用の機能が有効になる
// - 個人用のページ/APIは *.personal.tsx / *.personal.ts という名前にしておくと、
//   公開ビルド(静的書き出し)ではルートとして認識されず、完全に除外される
// - 公開ページに埋め込む個人用コンポーネントは、公開ビルドではスタブに差し替える
const personal = process.env.PERSONAL_MODE === "1";

// 公開ビルドでスタブに差し替えるモジュール (実体 → スタブ)
const publicStubs: Record<string, string> = personal
  ? {}
  : {
      "@/components/personal/ai-review-section": "./src/components/personal/ai-review-section.public.ts",
    };

const nextConfig: NextConfig = {
  // 公開サイトはサーバーもDBも不要な静的サイトとして書き出す
  output: personal ? undefined : "export",
  pageExtensions: personal ? ["personal.tsx", "personal.ts", "tsx", "ts"] : ["tsx", "ts"],
  basePath,
  images: { unoptimized: true },
  // 静的ホスティングで /stocks/1414 のようなURLをそのまま開けるようにする。
  // 個人モード(サーバー動作)では不要で、APIへのPOSTがリダイレクトされてしまうため無効にする
  trailingSlash: !personal,
  turbopack: { resolveAlias: publicStubs },
  webpack: (config) => {
    for (const [from, to] of Object.entries(publicStubs)) {
      config.resolve.alias[from] = path.resolve(process.cwd(), to);
    }
    return config;
  },
};

export default nextConfig;
