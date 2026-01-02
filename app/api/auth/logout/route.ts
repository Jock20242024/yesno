/**
 * 登出 API
 * POST /api/auth/logout
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteSession } from '@/lib/auth-core/sessionStore';

export async function POST() {
  try {
    const cookieStore = await cookies();
    
    // 🔥 清除服务器端的 session（先清除，避免后续 cookie 检查时仍认为有 session）
    const sessionId = cookieStore.get('auth_core_session')?.value;
    if (sessionId) {
      try {
        await deleteSession(sessionId);
      } catch (e) {
        // 忽略错误，继续执行
      }
    }
    
    // 🔥 清除所有认证相关的 Cookies
    // 使用明确的过期时间确保 cookie 被删除
    const cookieOptions = {
      expires: new Date(0), // 设置为过去的时间，确保立即过期
      path: '/',
    };
    
    cookieStore.delete('auth_user_id');
    cookieStore.set('auth_user_id', '', cookieOptions);
    
    cookieStore.delete('auth_core_session');
    cookieStore.set('auth_core_session', '', cookieOptions);
    
    cookieStore.delete('authToken');
    cookieStore.set('authToken', '', cookieOptions);
    
    cookieStore.delete('adminToken');
    cookieStore.set('adminToken', '', cookieOptions);
    
    // 🔥 清除 NextAuth session cookie（如果存在）
    // NextAuth v5 的 session cookie 名称可能是动态的，尝试常见的名称
    cookieStore.delete('next-auth.session-token');
    cookieStore.set('next-auth.session-token', '', cookieOptions);
    
    cookieStore.delete('__Secure-next-auth.session-token');
    cookieStore.set('__Secure-next-auth.session-token', '', cookieOptions);
    
    // 🔥 清除所有可能的 NextAuth cookie 变体
    const allCookies = cookieStore.getAll();
    allCookies.forEach(cookie => {
      if (cookie.name.includes('next-auth') || cookie.name.includes('auth')) {
        cookieStore.delete(cookie.name);
        cookieStore.set(cookie.name, '', cookieOptions);
      }
    });

    return NextResponse.json({
      success: true,
      message: '登出成功',
    });
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Logout API Error:', error);
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
