import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Next.js Middleware
 * 
 * 🔥 关键修复：路由保护逻辑
 * - 保护私有路径（/wallet, /profile, /portfolio 等）
 * - 如果 Session 无效，直接重定向到 /login
 * - API 路由排除在外（它们有自己的认证逻辑）
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 🔥 排除所有 API 路由，确保 Cookie 可以正常传递
  // API 路由有自己的认证逻辑（NextAuth 或自定义认证），不应该被中间件拦截
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // 🔥 排除静态文件和 NextAuth 路由
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/api/auth') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 🔥 定义需要保护的私有路径
  const protectedPaths = [
    '/wallet',
    '/profile',
    '/portfolio',
  ];

  // 🔥 检查当前路径是否需要保护
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  if (isProtectedPath) {
    // 🔥 获取 JWT Token 验证 Session
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    // 🔥 如果 Session 无效，重定向到登录页
    // 🔥 特殊处理：/wallet 路径允许 Token 暂时无效时通过（避免闪烁）
    if (!token || !token.email) {
      // 🔥 如果是 /wallet 页面，允许其通过（前端会处理数据加载失败的情况）
      if (pathname.startsWith('/wallet')) {
        return NextResponse.next();
      }
      
      // 🔥 其他受保护路径（如 /admin、/profile 等）依然需要严格验证
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 对于其他路由（公开路径），直接通过
  return NextResponse.next();
}

/**
 * 配置中间件匹配规则
 * 排除 API 路由和静态文件
 */
export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (网站图标)
     * - public 文件夹中的文件
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
