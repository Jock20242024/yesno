import { DataClient } from './DataClient';

/**
 * 数据页面 - 生产环境骨架屏策略
 * 
 * 🔥 核心策略：
 * 1. 服务端不获取任何数据，不传递 props
 * 2. 只返回页面框架，数据完全由客户端获取
 * 3. 强制动态模式，防止静态化
 */
// 🔥 强制动态模式 (生产环境生效)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DataPage() {
  // 🔥 服务端不获取数据，不传 props，只渲染客户端组件容器
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="layout-container flex h-full grow flex-col w-full lg:max-w-[1440px] lg:mx-auto px-4 lg:px-10 py-8">
        <DataClient />
      </div>
    </div>
  );
}
