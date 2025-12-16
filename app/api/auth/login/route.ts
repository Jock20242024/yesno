import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DBService } from '@/lib/mockData';
import { comparePassword } from '@/services/authService';

/**
 * 登录 API
 * POST /api/auth/login
 * 
 * 处理用户登录请求
 * 请求体：
 * - email: 邮箱地址
 * - password: 密码
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 验证必需字段
    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email and password are required',
        },
        { status: 400 }
      );
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email format',
        },
        { status: 400 }
      );
    }

    // 查找用户（包括 passwordHash）
    const user = await DBService.findUserByEmail(email);

    // 调试日志：打印用户对象和输入的密码（不打印完整密码）
    console.log('🔍 [Login API] 开始密码验证:');
    console.log(`   Email: ${email}`);
    console.log(`   用户输入的密码长度: ${password.length}`);
    console.log(`   用户对象:`, {
      id: user?.id,
      email: user?.email,
      isAdmin: user?.isAdmin,
      isBanned: user?.isBanned,
      passwordHashExists: !!user?.passwordHash,
      passwordHashLength: user?.passwordHash?.length || 0,
      passwordHashPrefix: user?.passwordHash?.substring(0, 30) || 'N/A',
    });

    // 验证用户是否存在
    if (!user) {
      console.error('❌ [Login API] 用户不存在:', email);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email or password',
        },
        { status: 401 }
      );
    }

    // 检查用户是否被禁用
    if (user.isBanned) {
      console.error('❌ [Login API] 用户账户被禁用:', email);
      return NextResponse.json(
        {
          success: false,
          error: 'Account is banned. Please contact support.',
        },
        { status: 403 }
      );
    }

    // 使用 authService 验证密码
    console.log('🔍 [Login API] 调用 comparePassword 进行密码验证...');
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    console.log(`🔍 [Login API] 密码验证结果: ${isPasswordValid}`);
    console.log(`   输入的密码: ${password.substring(0, 3)}*** (长度: ${password.length})`);
    console.log(`   存储的哈希: ${user.passwordHash.substring(0, 30)}... (长度: ${user.passwordHash.length})`);
    
    if (!isPasswordValid) {
      console.error('❌ [Login API] 密码验证失败:', {
        email,
        passwordLength: password.length,
        hashLength: user.passwordHash.length,
        hashPrefix: user.passwordHash.substring(0, 30),
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email or password',
        },
        { status: 401 }
      );
    }

    console.log('✅ [Login API] 密码验证成功，用户登录成功:', email);

    // 生成认证 Token（占位符，生产环境应使用 JWT）
    const authToken = `auth-token-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const adminToken = user.isAdmin ? 'ADMIN_SECRET_TOKEN' : null;

    // 设置 HttpOnly Cookie
    const cookieStore = await cookies();
    
    // 设置用户认证 Token Cookie
    cookieStore.set('authToken', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: '/',
    });

    // 如果是管理员，设置管理员 Token Cookie
    if (user.isAdmin && adminToken) {
      cookieStore.set('adminToken', adminToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 天
        path: '/',
      });
    }

    // 返回脱敏的用户信息（不包含 passwordHash）
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
        balance: user.balance,
        // 不返回 passwordHash 和 token（Token 在 Cookie 中）
      },
    });
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
