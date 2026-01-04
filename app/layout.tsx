import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

// 🔥 临时禁用字体优化，避免构建时网络问题
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "700", "900"],
  display: 'swap',
  preload: false, // 禁用预加载，避免构建时下载
});

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-noto-sans-sc",
  weight: ["400", "500", "700"],
  display: 'swap',
  preload: false, // 禁用预加载，避免构建时下载
});

export const metadata: Metadata = {
  title: "YesNo - Prediction Market",
  description: "Predict the future, earn rewards. Join the global prediction market.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className="dark" lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{
          __html: `
            .material-symbols-outlined {
              font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            }
          `
        }} />
        {/* 🔥 修复 ChunkLoadError：添加全局 chunk 加载错误处理 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined') return;
                
                // 监听 chunk 加载错误
                window.addEventListener('error', function(e) {
                  if (e.message && (e.message.includes('chunk') || e.message.includes('ChunkLoadError'))) {
                    console.warn('⚠️ [Global] 检测到 ChunkLoadError，准备刷新页面...');
                    // 清除所有缓存
                    if ('caches' in window) {
                      caches.keys().then(function(names) {
                        for (let name of names) caches.delete(name);
                      });
                    }
                    // 延迟刷新，避免无限循环
                    setTimeout(function() {
                      window.location.reload(true);
                    }, 1000);
                  }
                }, true);
                
                // 监听未处理的 Promise 拒绝（chunk 加载失败）
                window.addEventListener('unhandledrejection', function(e) {
                  if (e.reason && (e.reason.message && (e.reason.message.includes('chunk') || e.reason.message.includes('ChunkLoadError')))) {
                    console.warn('⚠️ [Global] 检测到 ChunkLoadError Promise 拒绝，准备刷新页面...');
                    e.preventDefault();
                    setTimeout(function() {
                      window.location.reload(true);
                    }, 1000);
                  }
                });
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${notoSansSC.variable} bg-background-dark text-white min-h-screen flex flex-col font-display selection:bg-primary selection:text-black max-w-[100vw] overflow-x-hidden`}
      >
        <Providers>
          {children}
        </Providers>
        <Toaster
          position="bottom-left"
          richColors
          closeButton
        />
      </body>
    </html>
  );
}
