'use client';

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
  return (
    <div style={{ padding: 40 }}>
      <h1>Something went wrong</h1>
      <pre>{error.message}</pre>
      <button onClick={() => reset()}>Retry</button>
    </div>
  );
}
