'use client';

import { usePathname } from 'next/navigation';
import { StoreProvider } from '@/app/context/StoreContext';
import { AuthProvider } from "@/components/providers/AuthProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import Navbar from "@/components/Navbar";
import CategoryBar from "@/components/CategoryBar";
import { ToastProvider } from "@/components/providers/ToastProvider";

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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StoreProvider>
        <NotificationProvider>
          <ConditionalUI>
            {children}
          </ConditionalUI>
        </NotificationProvider>
      </StoreProvider>
    </AuthProvider>
  );
}
