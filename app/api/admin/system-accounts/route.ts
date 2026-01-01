import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/utils';
import { randomUUID } from 'crypto';

// 🔥 强制动态：确保每次请求都获取最新数据
export const dynamic = 'force-dynamic';

/**
 * 系统账户类型定义
 */
const SYSTEM_ACCOUNT_EMAILS = {
  FEE: 'system.fee@yesno.com',        // 手续费账户
  AMM: 'system.amm@yesno.com',        // AMM 资金池
  LIQUIDITY: 'system.liquidity@yesno.com', // 流动性账户
} as const;

/**
 * 获取系统账户信息
 * GET /api/admin/system-accounts
 */
export async function GET() {
  try {
    // 🔥 权限检查：只有管理员可以访问
    const authResult = await requireAuth();
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.statusCode }
      );
    }

    // 检查是否为管理员
    const user = await prisma.users.findUnique({
      where: { id: authResult.userId },
      select: { isAdmin: true },
    });

    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    // 查询三个系统账户（使用 findFirst 避免找不到时抛出错误）
    const [feeAccount, ammAccount, liquidityAccount] = await Promise.all([
      prisma.users.findFirst({
        where: { email: SYSTEM_ACCOUNT_EMAILS.FEE },
        select: {
          id: true,
          email: true,
          balance: true,
          createdAt: true,
        },
      }).catch(() => null),
      prisma.users.findFirst({
        where: { email: SYSTEM_ACCOUNT_EMAILS.AMM },
        select: {
          id: true,
          email: true,
          balance: true,
          createdAt: true,
        },
      }).catch(() => null),
      prisma.users.findFirst({
        where: { email: SYSTEM_ACCOUNT_EMAILS.LIQUIDITY },
        select: {
          id: true,
          email: true,
          balance: true,
          createdAt: true,
        },
      }).catch(() => null),
    ]);

    // 如果账户不存在，返回默认值（但确保日期格式正确）
    const accounts = {
      fee: feeAccount ? {
        id: feeAccount.id,
        email: feeAccount.email,
        balance: feeAccount.balance,
        createdAt: feeAccount.createdAt,
      } : {
        id: '',
        email: SYSTEM_ACCOUNT_EMAILS.FEE,
        balance: 0,
        createdAt: new Date().toISOString(),
      },
      amm: ammAccount ? {
        id: ammAccount.id,
        email: ammAccount.email,
        balance: ammAccount.balance,
        createdAt: ammAccount.createdAt,
      } : {
        id: '',
        email: SYSTEM_ACCOUNT_EMAILS.AMM,
        balance: 0,
        createdAt: new Date().toISOString(),
      },
      liquidity: liquidityAccount ? {
        id: liquidityAccount.id,
        email: liquidityAccount.email,
        balance: liquidityAccount.balance,
        createdAt: liquidityAccount.createdAt,
      } : {
        id: '',
        email: SYSTEM_ACCOUNT_EMAILS.LIQUIDITY,
        balance: 0,
        createdAt: new Date().toISOString(),
      },
    };

    // 确保日期格式统一为 ISO 字符串
    const serializedAccounts = {
      fee: {
        ...accounts.fee,
        createdAt: accounts.fee.createdAt instanceof Date 
          ? accounts.fee.createdAt.toISOString() 
          : accounts.fee.createdAt,
      },
      amm: {
        ...accounts.amm,
        createdAt: accounts.amm.createdAt instanceof Date 
          ? accounts.amm.createdAt.toISOString() 
          : accounts.amm.createdAt,
      },
      liquidity: {
        ...accounts.liquidity,
        createdAt: accounts.liquidity.createdAt instanceof Date 
          ? accounts.liquidity.createdAt.toISOString() 
          : accounts.liquidity.createdAt,
      },
    };

    return NextResponse.json({
      success: true,
      data: serializedAccounts,
    });
  } catch (error) {
    console.error('❌ [System Accounts API] 获取系统账户失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch system accounts',
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? { details: error.message }
          : {}),
      },
      { status: 500 }
    );
  }
}

/**
 * 操作系统账户资金
 * POST /api/admin/system-accounts
 * 
 * Body:
 * - accountType: 'fee' | 'amm' | 'liquidity'
 * - action: 'withdraw' | 'deposit'
 * - amount: number
 * - reason?: string
 */
export async function POST(request: Request) {
  try {
    // 🔥 权限检查：只有管理员可以操作
    const authResult = await requireAuth();
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.statusCode }
      );
    }

    // 检查是否为管理员
    const user = await prisma.users.findUnique({
      where: { id: authResult.userId },
      select: { isAdmin: true },
    });

    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { accountType, action, amount, reason } = body;

    // 验证参数
    if (!accountType || !['fee', 'amm', 'liquidity'].includes(accountType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid accountType' },
        { status: 400 }
      );
    }

    if (!action || !['withdraw', 'deposit'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // 获取系统账户 email
    const accountEmail = SYSTEM_ACCOUNT_EMAILS[accountType.toUpperCase() as keyof typeof SYSTEM_ACCOUNT_EMAILS];

    // 使用事务确保原子性
    const result = await prisma.$transaction(async (tx) => {
      // 查找或创建系统账户
      let systemAccount = await tx.users.findUnique({
        where: { email: accountEmail },
      });

      if (!systemAccount) {
        // 如果账户不存在，创建它
        systemAccount = await tx.users.create({
          data: {
            id: randomUUID(),
            updatedAt: new Date(),
            email: accountEmail,
            balance: 0,
            isAdmin: false,
            isBanned: false,
          },
        });
      }

      // 计算新余额
      const currentBalance = systemAccount.balance;
      let newBalance: number;

      if (action === 'withdraw') {
        // 提取：减少余额
        if (currentBalance < amount) {
          throw new Error(`Insufficient balance: ${currentBalance} < ${amount}`);
        }
        newBalance = currentBalance - amount;
      } else {
        // 充值：增加余额
        newBalance = currentBalance + amount;
      }

      // 更新账户余额
      const updatedAccount = await tx.users.update({
        where: { id: systemAccount.id },
        data: { balance: newBalance },
      });

      // 记录交易流水
      await tx.transactions.create({
        data: {
          id: randomUUID(),
          userId: systemAccount.id,
          amount: action === 'withdraw' ? -amount : amount,
          type: action === 'withdraw' ? 'ADMIN_ADJUSTMENT' : 'ADMIN_ADJUSTMENT',
          reason: reason || `${action === 'withdraw' ? '提取' : '补充'}资金 - ${accountType}账户`,
          status: 'COMPLETED',
        },
      });

      return updatedAccount;
    });

    return NextResponse.json({
      success: true,
      data: {
        accountId: result.id,
        newBalance: result.balance,
      },
    });
  } catch (error) {
    console.error('❌ [System Accounts API] 操作系统账户失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update system account',
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? { details: error.stack }
          : {}),
      },
      { status: 500 }
    );
  }
}
