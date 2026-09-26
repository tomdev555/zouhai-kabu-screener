import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { MockDataBanner } from "@/components/layout/mock-data-banner";
import { isUsingMockData } from "@/lib/data-sources";
import { personalNavItems } from "@/components/personal/personal-sections";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "増配株ピックアップMe",
  description: "日本株の優良な増配株を毎朝スクリーニングし、AI総評とあわせて表示するサイト",
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
          <SidebarNav personalItems={personalNavItems} />
          <main className="flex-1 overflow-x-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
