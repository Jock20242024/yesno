'use client';

import { AuthProvider } from "@/components/providers/AuthProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import { StoreProvider } from "@/app/context/StoreContext";
import Navbar from "@/components/Navbar";
import CategoryBar from "@/components/CategoryBar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationProvider>
        <StoreProvider>
          <Navbar />
          <CategoryBar />
          {children}
        </StoreProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

