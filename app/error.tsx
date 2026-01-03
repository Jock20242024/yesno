'use client';

import { useEffect } from 'react';

/**
 * 全局错误边界 - 硬级别 Error Boundary
 * 任何组件报错 ≠ 白屏，直接进入错误兜底页
 * 
 * ⚠️ 规则：只有 app/layout.tsx 可以定义 <html><body>
 * error.tsx 绝不能再包 html/body，否则会破坏 DOM 结构
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // 🔥 处理 ChunkLoadError：自动重试加载
  useEffect(() => {
    if (error.message?.includes('chunk') || error.message?.includes('ChunkLoadError')) {
      console.warn('⚠️ [Error Boundary] 检测到 ChunkLoadError，尝试刷新页面...');
      // 延迟刷新，给用户看到错误信息的时间
      const timer = setTimeout(() => {
        window.location.reload();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const isChunkError = error.message?.includes('chunk') || error.message?.includes('ChunkLoadError');

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-400">
          {isChunkError ? '正在加载资源...' : 'Something went wrong'}
        </h1>
        <pre className="text-sm text-gray-400 mb-6 overflow-auto max-h-40 p-4 bg-gray-900 rounded">
          {error.message}
        </pre>
        {isChunkError ? (
          <p className="text-gray-500 mb-4">页面将在 2 秒后自动刷新...</p>
        ) : (
          <button
            onClick={() => reset()}
            className="px-6 py-3 bg-primary text-black font-bold rounded-lg hover:bg-primary/80 transition-colors"
          >
            重试
          </button>
        )}
      </div>
    </div>
  );
}
