/**
 * 登录 API - 最小版本
 * POST /api/auth/login
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword } from '@/services/authService';
import { cookies } from 'next/headers';
import { createSession } from '@/lib/auth-core/sessionStore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 验证必需字段
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // 查找用户
    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // 验证密码
    if (!user.passwordHash) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // 创建 session
    const sessionId = await createSession(user.id);

    // 设置 HttpOnly Cookie: auth_core_session
    const cookieStore = await cookies();
    cookieStore.set('auth_core_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/',
    });

    // 设置 HttpOnly Cookie: auth_user_id（与 /api/auth/me 对齐）
    cookieStore.set('auth_user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/',
    });

    // 返回成功，包含 user 数据和 token
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        balance: user.balance || 0,
        isAdmin: user.isAdmin || false,
      },
      token: sessionId, // 返回 sessionId 作为 token（保持兼容性）
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
