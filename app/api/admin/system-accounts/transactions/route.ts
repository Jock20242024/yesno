import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/utils';

export const dynamic = 'force-dynamic';

/**
 * 获取系统账户交易流水
 * GET /api/admin/system-accounts/transactions
 * 
 * Query Params:
 * - accountType?: 'fee' | 'amm' | 'liquidity' | 'all'
 */
export async function GET(request: NextRequest) {
  try {
    // 权限检查
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

    const { searchParams } = new URL(request.url);
    const accountType = searchParams.get('accountType') || 'all';

    // 系统账户邮箱映射
    const SYSTEM_ACCOUNT_EMAILS = {
      FEE: 'system.fee@yesno.com',
      AMM: 'system.amm@yesno.com',
      LIQUIDITY: 'system.liquidity@yesno.com',
    } as const;

    // 获取系统账户ID
    const accountIds: string[] = [];
    
    if (accountType === 'all') {
      // 获取所有系统账户
      const [feeAccount, ammAccount, liquidityAccount] = await Promise.all([
        prisma.users.findFirst({ where: { email: SYSTEM_ACCOUNT_EMAILS.FEE }, select: { id: true } }),
        prisma.users.findFirst({ where: { email: SYSTEM_ACCOUNT_EMAILS.AMM }, select: { id: true } }),
        prisma.users.findFirst({ where: { email: SYSTEM_ACCOUNT_EMAILS.LIQUIDITY }, select: { id: true } }),
      ]);
      
      if (feeAccount) accountIds.push(feeAccount.id);
      if (ammAccount) accountIds.push(ammAccount.id);
      if (liquidityAccount) accountIds.push(liquidityAccount.id);
    } else {
      const accountEmail = SYSTEM_ACCOUNT_EMAILS[accountType.toUpperCase() as keyof typeof SYSTEM_ACCOUNT_EMAILS];
      const account = await prisma.users.findFirst({
        where: { email: accountEmail },
        select: { id: true },
      });
      
      if (account) {
        accountIds.push(account.id);
      }
    }

    if (accountIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // 查询交易记录（按时间倒序，最多返回1000条）
    const transactions = await prisma.transactions.findMany({
      where: {
        userId: { in: accountIds },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1000,
      include: {
        users: {
          select: {
            email: true,
          },
        },
      },
    });

    // 计算变动后余额（需要按时间顺序计算累计余额）
    // 为了计算余额，我们需要按时间正序处理，然后反转结果
    const sortedTransactions = [...transactions].reverse(); // 时间正序
    
    // 获取每个账户的初始余额（当前余额 - 所有交易的累计变动）
    const accountBalances = new Map<string, number>();
    
    for (const tx of sortedTransactions) {
      if (!accountBalances.has(tx.userId)) {
        // 获取当前余额
        const account = await prisma.users.findUnique({
          where: { id: tx.userId },
          select: { balance: true },
        });
        
        // 计算初始余额 = 当前余额 - 所有交易的累计变动
        const totalChange = transactions
          .filter(t => t.userId === tx.userId)
          .reduce((sum, t) => sum + t.amount, 0);
        
        accountBalances.set(tx.userId, (account?.balance || 0) - totalChange);
      }
    }

    // 计算每条交易的变动后余额
    const transactionsWithBalance = sortedTransactions.map((tx, index) => {
      const currentBalance = accountBalances.get(tx.userId) || 0;
      
      // 计算到当前交易为止的累计变动
      const cumulativeChange = sortedTransactions
        .slice(0, index + 1)
        .filter(t => t.userId === tx.userId)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const balanceAfter = currentBalance + cumulativeChange;
      
      return {
        id: tx.id,
        userId: tx.userId,
        userEmail: tx.users.email,
        amount: tx.amount,
        type: tx.type,
        reason: tx.reason,
        createdAt: tx.createdAt.toISOString(),
        status: tx.status,
        balanceAfter: Math.round(balanceAfter * 100) / 100, // 保留2位小数
      };
    });

    // 反转回时间倒序
    transactionsWithBalance.reverse();

    return NextResponse.json({
      success: true,
      data: transactionsWithBalance,
    });
  } catch (error) {
    console.error('❌ [System Accounts Transactions API] 获取交易流水失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch transactions',
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? { details: error.message }
          : {}),
      },
      { status: 500 }
    );
  }
}

