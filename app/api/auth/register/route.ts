/**
 * 注册 API - 最小版本
 * POST /api/auth/register
 */

import { NextResponse } from 'next/server';
import { hashPassword } from '@/services/authService';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { createSession } from '@/lib/auth-core/sessionStore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, provider = 'email' } = body;

    // 此 API 仅支持邮箱注册，OAuth 注册通过 NextAuth 处理
    if (provider !== 'email') {
      return NextResponse.json(
        { success: false, error: 'Only email registration is supported via this endpoint' },
        { status: 501 }
      );
    }

    // 验证必需字段
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // email 注册需要 password
    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password is required for email registration' },
        { status: 400 }
      );
    }

    // 检查用户是否已存在（仅根据 email）
    const existingUser = await prisma.user.findUnique({ 
      where: { email } 
    });
    
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Email already exists",
        },
        { status: 409 }
      );
    }

    // 哈希密码
    const passwordHash = await hashPassword(password);
    if (!passwordHash || passwordHash.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to hash password' },
        { status: 500 }
      );
    }

    // 创建用户数据
    const data: any = {
      email,
      passwordHash,
      provider: 'email',
      balance: 0.0,
      isAdmin: false,
      isBanned: false,
    };

    // 创建用户
    const user = await prisma.user.create({
      data,
    });

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

    // 返回成功，包含 user 数据（与登录 API 格式一致）
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        balance: user.balance || 0,
        isAdmin: user.isAdmin || false,
      },
      token: sessionId, // 返回 sessionId 作为 token（保持兼容性）
    }, { status: 201 });
  } catch (error) {
    console.error("REGISTER API ERROR", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
