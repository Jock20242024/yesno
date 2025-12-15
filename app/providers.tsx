'use client';

import { useState, useEffect } from 'react';
import { StoreProvider } from '@/app/context/StoreContext';
import { AuthProvider } from "@/components/providers/AuthProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import Navbar from "@/components/Navbar";
import CategoryBar from "@/components/CategoryBar";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 核心：在客户端加载完成前，只渲染一个空的 div
  // 这样服务器永远不会渲染出导致冲突的 HTML
  if (!mounted) {
    return <div className="min-h-screen bg-background-dark" />;
  }

  return (
    <StoreProvider>
      <AuthProvider>
        <NotificationProvider>
          <Navbar />
          <CategoryBar />
          {children}
          <Toaster
            position="top-center"
            richColors
            closeButton
            theme="dark"
          />
        </NotificationProvider>
      </AuthProvider>
    </StoreProvider>
  );
}
