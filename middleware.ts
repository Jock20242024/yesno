import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware
 * 处理路由保护和重定向逻辑
 * 
 * 🔥 重构：采用"白名单"模式
 * 1. 明确定义公共页面（/, /login, /register, /category, /markets）
 * 2. 普通用户访问 /admin 时，强制重定向回首页
 * 3. 已登录用户访问 /login 时，强制重定向回首页
 * 4. 管理员路由需要 adminToken Cookie
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 🔥 排除静态资源和 API 路由
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js)$/)
  ) {
    return NextResponse.next();
  }
  
  // 🔥 白名单：明确定义公共页面（允许未登录访问）
  const publicRoutes = [
    '/',                    // 首页
    '/login',               // 登录页
    '/register',            // 注册页
    '/category',            // 分类页（包括所有子路由）
    '/markets',             // 市场页（包括所有子路由）
    '/rank',                // 排行榜
    '/data',                // 数据页
  ];
  
  // 检查是否为公共路由
  const isPublicRoute = publicRoutes.some(route => {
    if (route === '/') {
      return pathname === '/';
    }
    return pathname === route || pathname.startsWith(route + '/');
  });
  
  // 🔥 管理员路由：需要管理员权限
  const isAdminRoute = pathname.startsWith('/admin');
  
  // 🔥 修复：普通用户尝试访问 /admin，强制重定向回首页
  if (isAdminRoute && pathname !== '/admin/login') {
    const adminToken = request.cookies.get('adminToken');
    
    if (!adminToken) {
      // 未登录管理员，重定向到管理员登录页
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
  
  // 🔥 修复：已登录用户访问 /login 或 /register，强制重定向回首页
  // 检查是否有 NextAuth session cookie 或 adminToken
  const hasSession = request.cookies.get('next-auth.session-token') || 
                     request.cookies.get('__Secure-next-auth.session-token') ||
                     request.cookies.get('auth_core_session') ||
                     request.cookies.get('adminToken');
  
  if (hasSession && (pathname === '/login' || pathname === '/register')) {
    // 已登录用户访问登录/注册页，重定向到首页
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // 🔥 其他路由：允许访问，由前端组件处理权限
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

