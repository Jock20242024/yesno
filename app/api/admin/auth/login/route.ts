import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DBService } from '@/lib/dbService'; // 🔥 修复：使用正确的 dbService 而不是 mockData
import { comparePassword } from '@/services/authService';

/**
 * 管理后台 - Admin 登录 API
 * POST /api/admin/auth/login
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
    const user = await DBService.findUserByEmail(adminEmail);
    
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

    // 调试日志：记录用户信息和密码验证过程

    // 使用 authService.comparePassword 验证密码（强制等待 await）
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

    // Token 生成：生成专属的 adminAuthToken
    // 格式: admin-token-{userId}-{timestamp}-{random}
    // 确保格式与 verifyAdminToken 中的解析逻辑一致
    const adminAuthToken = `admin-token-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // 设置 Cookie：使用 Set-Cookie Header 将 adminAuthToken 设置为 HttpOnly Cookie
    // Key 必须是 adminToken（与 Middleware 中检查的 Key 保持一致）
    const cookieStore = await cookies();
    
    // 确保 Cookie 设置正确：
    // 1. Key 必须是 'adminToken'（与 middleware.ts 一致）
    // 2. HttpOnly: true（安全要求）
    // 3. maxAge: 7 天（604800 秒），确保 Token 不会立即过期
    // 4. path: '/'（确保在所有路径下可用）
    cookieStore.set('adminToken', adminAuthToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天 (604800 秒)
      path: '/',
    });

    // 同时设置 authToken（用于向后兼容）
    const authToken = `auth-token-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    cookieStore.set('authToken', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/',
    });

    // 返回成功响应（确保标准 JSON 格式和状态码）
    const response = NextResponse.json(
      {
        success: true,
        message: 'Admin login successful',
        user: {
          id: user.id,
          email: user.email,
          isAdmin: true,
          balance: user.balance,
        },
      },
      { status: 200 }
    );

    return response;
  } catch (error) {
    console.error('Admin login API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

