import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/authExport';

/**
 * Next.js Middleware - 最终修复版本（基于诊断报告）
 * 
 * ⚡ 核心原则：绝对放行静态资源，精确匹配，避免误拦截
 * 
 * 修复要点：
 * 1. 使用更精确的路径匹配（避免 pathname.includes('.') 误匹配）
 * 2. 优先检查 Next.js 内部资源
 * 3. 排除 API 路由，避免误匹配
 * 4. 使用 NextAuth auth() 函数自动处理 session
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 【极高优先级】绝对放行：使用精确匹配，避免误拦截
  if (
    // Next.js 内部资源（最优先，使用精确匹配）
    pathname.startsWith('/_next/') ||
    // 静态文件目录
    pathname.startsWith('/static/') ||
    // NextAuth API 路由
    pathname.startsWith('/api/auth/') ||
    // Favicon
    pathname === '/favicon.ico' ||
    // 静态文件扩展名（但排除 API 路由，避免误匹配）
    (pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2|ttf|eot|map|json)$/i) && 
     !pathname.startsWith('/api/'))
  ) {
    return NextResponse.next();
  }

  // 2. 获取 session（只在需要权限检查的路径才调用，避免不必要的开销）
  let session = null;
  const needsAuthCheck = pathname.startsWith('/admin') || pathname === '/login' || pathname === '/register';
  
  if (needsAuthCheck) {
    try {
      session = await auth();
    } catch (error) {
      // 如果 auth() 失败，说明没有有效的 session
      // 静默处理，不输出日志
    }
  }

  // 3. 检查管理员权限 (仅针对 /admin 开头的路径)
  if (pathname.startsWith('/admin')) {
    // 如果是登录页本身，放行
    if (pathname === '/admin/login') {
      return NextResponse.next();
    }

    // 检查 session 和角色
    const isAuthenticated = !!session?.user;
    const userRole = (session?.user as any)?.role;
    const isAdmin = userRole?.toLowerCase() === 'admin';

    // 如果没有有效的管理员 session，重定向到登录页
    if (!isAuthenticated || !isAdmin) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 4. 已登录用户访问 /login 或 /register，重定向到首页
  if (session?.user && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// 简化 matcher：只匹配需要检查的路径
export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|static).*)'],
};

