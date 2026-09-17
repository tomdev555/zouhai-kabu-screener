import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { MockDataBanner } from "@/components/layout/mock-data-banner";
import { isUsingMockData } from "@/lib/data-sources";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "増配株ナビ",
  description: "優良な増配株をスクリーニングし、ウォッチリスト・運用実績を管理するアプリ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const isMock = isUsingMockData();

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <MockDataBanner isMock={isMock} />
        <div className="flex flex-1">
          <SidebarNav />
          <main className="flex-1 overflow-x-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
