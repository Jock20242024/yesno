'use client';

import { SessionProvider } from 'next-auth/react';
import { StoreProvider } from '@/app/context/StoreContext';
import { AuthProvider } from "@/components/providers/AuthProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import { ErrorBoundary } from "@/components/providers/ErrorBoundary";
import { LanguageProvider } from "@/i18n/LanguageContext";
import Navbar from "@/components/Navbar";
import CategoryBar from "@/components/CategoryBar";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { usePathname } from 'next/navigation';

// 🔥 全局初始化 Dayjs：在应用启动时一次性加载所有需要的插件
import '@/lib/dayjs';

function ConditionalUI({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 检查是否为管理后台路径
  const isAdminPath = pathname?.startsWith('/admin');

  return (
    <>
      {/* Navbar 仅在非 Admin 路径下渲染 */}
      {!isAdminPath && <Navbar />}
      {/* 管理后台路径不渲染 CategoryBar */}
      {!isAdminPath && (
        <CategoryBar />
      )}
      {children}
      <ToastProvider />
    </>
  );
}

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      {/* 🔥 修复：SessionProvider 配置，确保 Session 同步和 Cookie 策略正确 */}
      <SessionProvider
        refetchInterval={0} // 禁用自动刷新，避免干扰
        refetchOnWindowFocus={false} // 禁用窗口聚焦时刷新
      >
        <LanguageProvider>
          <AuthProvider>
            <StoreProvider>
              <NotificationProvider>
                <ConditionalUI>
                  {children}
                </ConditionalUI>
              </NotificationProvider>
            </StoreProvider>
          </AuthProvider>
        </LanguageProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}
