import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteSession } from '@/lib/auth-core/sessionStore';

/**
 * Auth Core - 登出 API
 * POST /api/auth-core/logout
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_core_session');

    // 删除 session
    if (sessionId?.value) {
      await deleteSession(sessionId.value);
    }

    // 清 Cookie
    cookieStore.delete('auth_core_session');

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
