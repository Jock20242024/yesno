import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword } from '@/services/authService';

/**
 * 管理后台 - Admin 登录 API（已废弃，仅用于验证）
 * POST /api/admin/auth/login
 * 
 * 🔥 注意：此 API 仅用于验证凭据，实际登录由前端调用 NextAuth signIn 完成
 * 
 * 请求体：
 * {
 *   adminEmail: string;
 *   adminPassword: string;
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { adminEmail, adminPassword } = body;

    // 验证必需字段
    if (!adminEmail || !adminPassword) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin email and password are required',
        },
        { status: 400 }
      );
    }

    // 从数据库查找用户
    const user = await prisma.users.findUnique({
      where: { email: adminEmail },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        isAdmin: true,
        isBanned: true,
        balance: true,
        provider: true,
      },
    });
    
    // 验证用户是否存在
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid admin credentials',
        },
        { status: 401 }
      );
    }

    // 验证是否为管理员
    if (!user.isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'User is not an administrator',
        },
        { status: 403 }
      );
    }

    // 验证账户是否被禁用
    if (user.isBanned) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin account is banned',
        },
        { status: 403 }
      );
    }

    // 🔥 修复：检查用户是否是通过 Google 注册的
    if (user.provider === 'google') {
      return NextResponse.json(
        {
          success: false,
          error: 'Google users must use Google login',
        },
        { status: 403 }
      );
    }

    // 验证密码
    if (!user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid admin credentials',
        },
        { status: 401 }
      );
    }

    const isPasswordValid = await comparePassword(adminPassword, user.passwordHash);

    if (!isPasswordValid) {
      console.error('❌ [Admin Login] 密码验证失败');
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid admin credentials',
        },
        { status: 401 }
      );
    }

    // 🔥 返回成功响应（前端会调用 NextAuth signIn 创建 session）
    return NextResponse.json(
      {
        success: true,
        message: 'Credentials validated',
        user: {
          id: user.id,
          email: user.email,
          isAdmin: true,
          balance: user.balance,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ [Admin Login] API 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

