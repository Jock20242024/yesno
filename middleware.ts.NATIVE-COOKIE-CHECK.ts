import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Next.js Middleware - 原生 Cookie 检查模式（不使用 NextAuth auth()）
 * 
 * ⚡ 核心原则：完全避免使用 NextAuth auth() 函数，改用原生 Cookie 检查
 * 
 * 修复要点：
 * 1. 绝对放行静态资源（在函数最顶部）
 * 2. 使用原生 Cookie 读取，不调用 auth() 函数
 * 3. 直接从 Cookie 中读取 session token 并验证
 * 4. 避免 NextAuth 在生产模式下的底层冲突
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 【极高优先级】绝对放行：所有静态资源和系统文件
  if (
    // Next.js 内部资源（最优先）
    pathname.startsWith('/_next/') ||
    // 静态文件目录
    pathname.startsWith('/static/') ||
    // NextAuth API 路由
    pathname.startsWith('/api/auth/') ||
    // Favicon
    pathname === '/favicon.ico' ||
    // 静态文件扩展名（但排除 API 路由）
    (pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2|ttf|eot|map|json)$/i) && 
     !pathname.startsWith('/api/'))
  ) {
    return NextResponse.next();
  }

  // 2. 检查管理员权限 (仅针对 /admin 开头的路径)
  if (pathname.startsWith('/admin')) {
    // 如果是登录页本身，放行
    if (pathname === '/admin/login') {
      return NextResponse.next();
    }

    // ⚡ 原生 Cookie 检查：不调用 auth() 函数
    // 检查 NextAuth session token cookie（兼容生产环境的 __Secure- 前缀）
    const sessionToken = 
      request.cookies.get('__Secure-next-auth.session-token')?.value ||
      request.cookies.get('next-auth.session-token')?.value;

    if (!sessionToken) {
      // 没有 session token，重定向到登录页
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // ⚡ 可选：验证 session token 是否有效（从数据库查询）
    // 注意：这里只做基本检查，详细验证由 API 路由处理
    // 如果需要更严格的验证，可以解析 JWT token 或查询数据库
    // 但为了性能，这里只检查 cookie 是否存在

    // 如果需要验证用户角色，可以：
    // 1. 解析 JWT token（如果 NextAuth 使用 JWT）
    // 2. 或者查询数据库（性能开销较大）
    // 3. 或者信任 cookie 存在性，由 API 路由做详细验证
    
    // 为了简化，这里只检查 cookie 是否存在
    // 详细的角色验证由各个 API 路由处理
  }

  // 3. 已登录用户访问 /login 或 /register，重定向到首页
  // 检查是否有 session token
  const sessionToken = 
    request.cookies.get('__Secure-next-auth.session-token')?.value ||
    request.cookies.get('next-auth.session-token')?.value;

  if (sessionToken && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// 简化 matcher：只匹配需要检查的路径
export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|static).*)'],
};

