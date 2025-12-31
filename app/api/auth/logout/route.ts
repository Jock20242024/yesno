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
    
    // 🔥 清除所有认证相关的 Cookies
    cookieStore.delete('auth_user_id');
    cookieStore.delete('auth_core_session');
    cookieStore.delete('authToken');
    cookieStore.delete('adminToken'); // 如果是管理员，也清除管理员 token
    
    // 🔥 清除 NextAuth session cookie（如果存在）
    // NextAuth v5 的 session cookie 名称可能是动态的，尝试常见的名称
    cookieStore.delete('next-auth.session-token');
    cookieStore.delete('__Secure-next-auth.session-token');
    
    // 🔥 清除服务器端的 session（如果有）
    const sessionId = cookieStore.get('auth_core_session')?.value;
    if (sessionId) {
      try {
        await deleteSession(sessionId);
      } catch (e) {
        // 忽略错误，继续执行
      }
    }

    return NextResponse.json({
      success: true,
      message: '登出成功',
    });
  } catch (error: any) {
    console.error('❌ [Logout API] 登出失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
