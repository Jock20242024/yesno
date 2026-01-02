'use client';

import { Toaster } from 'sonner';

/**
 * Toast Provider - 使用 sonner 提供 toast 通知功能
 */
export function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      duration={3000}
    />
  );
}
