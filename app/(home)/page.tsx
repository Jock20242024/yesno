import HomeClient from './HomeClient';

// 🔥 强制动态渲染：防止构建时数据请求失败
export const dynamic = 'force-dynamic';

export default function HomePage() {
  return <HomeClient />;
}

