"use client";

import LandingPage from "@/components/LandingPage";

// 注意：客户端组件不能使用 export const dynamic/revalidate
// 实时刷新通过 API 调用中的 cache: 'no-store' 实现

export default function Home() {
  return <LandingPage />;
}
