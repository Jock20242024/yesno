import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth-core/sessionStore';

/**
 * Auth Core - 获取当前用户信息 API
 * GET /api/auth-core/me
 */
export async function GET() {
  try {
    // 读取 Cookie: auth_core_session
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('auth_core_session');

    // 若无 session → 401
    if (!sessionCookie?.value) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // 获取 session 数据
    const userId = await getSession(sessionCookie.value);

    // 如果 session 无效或过期
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Session expired or invalid' },
        { status: 401 }
      );
    }

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // 检查用户是否被禁用
    if (user.isBanned) {
      return NextResponse.json(
        { success: false, error: 'Account is banned' },
        { status: 403 }
      );
    }

    // 返回用户信息
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        balance: user.balance,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
