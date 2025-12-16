import { NextResponse } from 'next/server';
import { DBService } from '@/lib/mockData';
import { User } from '@/types/data';
import { hashPassword } from '@/services/authService';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * 注册 API
 * POST /api/auth/register
 * 
 * 处理用户注册请求
 * 请求体：
 * - username: 用户名
 * - password: 密码
 * - email: 邮箱（可选）
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

    // 邮箱格式验证
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

    // 验证密码长度
    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password must be at least 6 characters',
        },
        { status: 400 }
      );
    }

    // 1. 查找现有用户 (findUserByEmail 必须返回 User 对象或 null)
    // 显式初始化为 null，确保变量状态明确
    let existingUser: User | null = null;
    
    try {
      existingUser = await DBService.findUserByEmail(email);
    } catch (error) {
      console.error(`[Register API] 查询用户时出错:`, error);
      // 查询出错时，不阻止注册流程，继续执行
    }
    
    // 2. 严格检查是否存在：只有在 existingUser 严格为非空对象时才返回 409
    // 检查 existingUser 是否为真值且具有必需的属性
    if (existingUser !== null && existingUser !== undefined && typeof existingUser === 'object' && existingUser.email === email) {
      console.log(`[Register API] 邮箱已存在，拒绝注册: ${email}`, {
        existingUser: {
          id: existingUser.id,
          email: existingUser.email,
          isAdmin: existingUser.isAdmin,
        },
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Email already exists',
        },
        { status: 409 } // 409 Conflict - 资源冲突
      );
    }
    
    // 3. 确保 existingUser 为 null 或 undefined，继续创建流程
    console.log(`[Register API] 用户不存在，继续创建: ${email}`, {
      existingUser: existingUser,
      isNull: existingUser === null,
      isUndefined: existingUser === undefined,
    });

    // 使用 authService.hashPassword() 对密码进行哈希处理
    const passwordHash = await hashPassword(password);
    
    // 验证密码哈希是否成功生成
    if (!passwordHash || passwordHash.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to hash password',
        },
        { status: 500 }
      );
    }

    // 使用 Prisma 直接创建新用户，以便捕获详细的错误信息
    // 新用户初始余额显式设置为 0.00
    const INITIAL_BALANCE = 0.0;
    console.log(`[Register API] 开始创建用户: ${email}`);
    
    let newUser: User | null = null;
    try {
      // 严格只传递必需字段：email, passwordHash, balance, isAdmin, isBanned
      // 显式排除 walletAddress 等可选字段，让数据库自动设置为 null，避免唯一性约束冲突
      const dbUser = await prisma.user.create({
        data: {
          email,
          passwordHash,
          balance: INITIAL_BALANCE,
          isAdmin: false,
          isBanned: false,
          // 注意：不传递 walletAddress，让数据库自动设置为 null
        },
      });
      
      // 转换为 User 类型
      newUser = {
        id: dbUser.id,
        email: dbUser.email,
        passwordHash: dbUser.passwordHash,
        balance: dbUser.balance,
        isAdmin: dbUser.isAdmin,
        isBanned: dbUser.isBanned,
        createdAt: dbUser.createdAt.toISOString(),
      };
      
      // 调试日志：打印创建结果
      console.log(`[Register API] 用户创建结果:`, {
        email,
        newUser: newUser ? {
          id: newUser.id,
          email: newUser.email,
          balance: newUser.balance,
        } : null,
      });
    } catch (error: any) {
      // 精准捕获 Prisma 唯一性约束错误 (P2002)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // P2002: Unique constraint failed
        const target = error.meta?.target as string[] | undefined;
        const conflictField = target && target.length > 0 ? target[0] : 'unknown';
        
        console.error(`[Register API] Prisma P2002 唯一性约束冲突:`, {
          email,
          errorCode: error.code,
          conflictField: conflictField,
          target: target,
          meta: error.meta,
        });
        
        return NextResponse.json(
          {
            success: false,
            error: `Email already exists`,
            conflictField: conflictField,
          },
          { status: 409 } // 409 Conflict - 资源冲突
        );
      }
      
      // 非 P2002 错误：打印完整错误信息
      console.error(`[Register API] Prisma 创建用户失败 (非 P2002 错误):`, {
        email,
        errorType: error.constructor?.name || typeof error,
        errorCode: error.code || 'N/A',
        errorMessage: error.message || String(error),
        errorStack: error.stack,
        fullError: error,
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create user',
        },
        { status: 500 }
      );
    }

    if (!newUser) {
      console.error(`[Register API] 用户创建失败: ${email}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create user',
        },
        { status: 500 }
      );
    }
    
    console.log(`[Register API] 用户创建成功: ${email}, ID: ${newUser.id}`);

    // 验证新用户数据完整性
    if (!newUser || !newUser.id || !newUser.email) {
      return NextResponse.json(
        {
          success: false,
          error: 'User creation failed: invalid user data',
        },
        { status: 500 }
      );
    }

    // 验证初始余额已正确设置为 0.00
    if (newUser.balance !== INITIAL_BALANCE) {
      console.error(`Warning: User ${newUser.id} balance mismatch. Expected: ${INITIAL_BALANCE}, Got: ${newUser.balance}`);
      // 如果余额不正确，尝试修正（可选）
      await DBService.updateUser(newUser.id, { balance: INITIAL_BALANCE });
    }

    // 强制打印成功信息：明确标记注册成功
    console.log(`✅ [Register API] ========== 注册成功 ==========`);
    console.log(`✅ [Register API] 用户邮箱: ${email}`);
    console.log(`✅ [Register API] 用户ID: ${newUser.id}`);
    console.log(`✅ [Register API] 创建时间: ${newUser.createdAt}`);
    console.log(`✅ [Register API] ===============================`);
    
    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        // 不返回密码信息
      },
    }, { status: 201 }); // 201 Created - 资源创建成功
  } catch (error) {
    console.error('Register API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

