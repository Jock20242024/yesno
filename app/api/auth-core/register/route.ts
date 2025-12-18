import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { hashPassword } from '@/lib/auth-core/authService';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/auth-core/sessionStore';

/**
 * Auth Core - 注册 API
 * POST /api/auth-core/register
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 验证必需字段
    if (!email || email.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!password || password.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // 验证密码长度
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({ 
      where: { email } 
    });
    
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already exists' },
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

    // 创建用户
    const INITIAL_BALANCE = 0.0;
    let newUser;
    
    try {
      const dbUser = await prisma.user.create({
        data: {
          email,
          passwordHash,
          balance: INITIAL_BALANCE,
          isAdmin: false,
          isBanned: false,
        },
      });
      
      newUser = {
        id: dbUser.id,
        email: dbUser.email,
        balance: dbUser.balance,
        isAdmin: dbUser.isAdmin,
      };
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'Email already exists' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // 创建 session
    const sessionId = await createSession(newUser.id);

    // 设置 HttpOnly Cookie: auth_core_session
    const cookieStore = await cookies();
    cookieStore.set('auth_core_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/',
    });

    // 返回 response
    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        isAdmin: newUser.isAdmin,
        balance: newUser.balance,
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
