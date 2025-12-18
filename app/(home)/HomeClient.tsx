'use client';

import { Suspense } from 'react';
import LandingPage from '@/components/LandingPage';

/**
 * 首页客户端组件
 * 架构加固：Client Component 只负责 UI 渲染，不直接读取 Context
 */
export default function HomeClient() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>}>
      <LandingPage />
    </Suspense>
  );
}
