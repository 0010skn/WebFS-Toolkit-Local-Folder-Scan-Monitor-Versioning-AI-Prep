import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Folda-Scan - 本地文件夹扫描工具",
  description:
    "扫描和监控本地项目文件夹的变化，支持.gitignore规则，实时生成项目结构和变更报告",
  keywords: [
    "文件夹扫描",
    "代码监控",
    "项目结构",
    "文件变更",
    "gitignore",
    "Web应用",
  ],
  authors: [{ name: "Folda-Scan Team" }],
  creator: "Folda-Scan Team",
  publisher: "Folda-Scan",
  metadataBase: new URL("https://folda-scan.vercel.app"),
  openGraph: {
    title: "Folda-Scan - 本地文件夹扫描工具",
    description:
      "扫描和监控本地项目文件夹的变化，支持.gitignore规则，实时生成项目结构和变更报告",
    url: "https://folda-scan.vercel.app",
    siteName: "Folda-Scan",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Folda-Scan - 本地文件夹扫描工具",
      },
    ],
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Folda-Scan - 本地文件夹扫描工具",
    description: "扫描和监控本地项目文件夹的变化，支持.gitignore规则",
    images: ["/og-image.png"],
    creator: "@folda_scan",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
