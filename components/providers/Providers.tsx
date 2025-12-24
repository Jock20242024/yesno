'use client';

import { AuthProvider } from "@/components/providers/AuthProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import { StoreProvider } from "@/app/context/StoreContext";
import { ErrorBoundary } from "@/components/providers/ErrorBoundary";
import Navbar from "@/components/Navbar";
import CategoryBar from "@/components/CategoryBar";

// 🔥 全局初始化 Dayjs：在应用启动时加载所有插件
import '@/lib/dayjs';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <StoreProvider>
            <Navbar />
            <CategoryBar />
            {children}
          </StoreProvider>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

