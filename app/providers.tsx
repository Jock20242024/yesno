'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { StoreProvider } from '@/app/context/StoreContext';
import { AuthProvider } from "@/components/providers/AuthProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import Navbar from "@/components/Navbar";
import CategoryBar from "@/components/CategoryBar";
import { Toaster } from "sonner";

function ConditionalUI({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 检查是否为管理后台路径
  const isAdminPath = pathname?.startsWith('/admin');

  // 核心：在客户端加载完成前，只渲染一个空的 div
  // 这样服务器永远不会渲染出导致冲突的 HTML
  if (!mounted) {
    // 如果是 admin 路径，返回 null，避免渲染任何内容
    if (isAdminPath) {
      return null;
    }
    return <div className="min-h-screen bg-background-dark" />;
  }

  return (
    <>
      {/* 管理后台路径不渲染 Navbar 和 CategoryBar */}
      {!isAdminPath && (
        <>
          <Navbar />
          <CategoryBar />
        </>
      )}
      {children}
      <Toaster
        position="top-center"
        richColors
        closeButton
        theme="dark"
      />
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <AuthProvider>
        <NotificationProvider>
          <ConditionalUI>
            {children}
          </ConditionalUI>
        </NotificationProvider>
      </AuthProvider>
    </StoreProvider>
  );
}
