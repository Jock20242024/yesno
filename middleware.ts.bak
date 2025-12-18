import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware - Admin 权限守卫
 * 
 * 在生产环境中，所有 /admin 路径的请求都会经过此中间件进行初步验证。
 * 验证逻辑：
 * 1. 检查请求的 cookies 中是否存在 adminToken（Admin 专属 Token）
 * 2. 如果不存在，重定向到 /admin/login 登录页
 * 3. 如果存在，允许通过（详细的权限验证在服务端组件中进行）
 * 
 * 注意：Middleware 运行在 Edge Runtime 中，不能直接调用 Prisma 或内部 API。
 * 详细的权限验证（如检查用户是否为管理员）应该在服务端组件或 API 路由中进行。
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 只处理 /admin 路径
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // 排除 API 路由（API 路由有自己的权限检查）
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // 排除 Admin 登录页面（避免重定向循环）
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  // 从 cookies 中读取 adminToken（Admin 专属 Token）
  const adminToken = request.cookies.get('adminToken');

  // 如果没有 adminToken，重定向到 Admin 登录页
  if (!adminToken) {
    const adminLoginUrl = new URL('/admin/login', request.url);
    adminLoginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(adminLoginUrl);
  }

  // 有 adminToken，允许通过
  // 详细的权限验证（检查是否为管理员）将在服务端组件中进行
  return NextResponse.next();
}

// 配置中间件匹配路径
export const config = {
  matcher: [
    '/admin/:path*',
  ],
};

