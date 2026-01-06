import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/authExport';

export const dynamic = 'force-dynamic';

const SYSTEM_ACCOUNT_EMAILS = {
  FEE: 'system.fee@yesno.com',
  AMM: 'system.amm@yesno.com',
  LIQUIDITY: 'system.liquidity@yesno.com',
} as const;

/**
 * 一键对账 API
 * GET /api/admin/system-accounts/reconcile
 * 
 * 统计 transactions 表所有记录的总和，并与 users 表中的余额对比
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || !(session.user as any).isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 1. 获取三个系统账户的当前余额
    const systemAccounts = await prisma.users.findMany({
      where: {
        email: {
          in: Object.values(SYSTEM_ACCOUNT_EMAILS),
        },
      },
      select: {
        id: true,
        email: true,
        balance: true,
      },
    });

    // 构建账户映射
    const accountMap = new Map(
      systemAccounts.map(acc => [acc.email, acc])
    );

    // 2. 统计每个账户的 transactions 总和
    const reconciliationResults = await Promise.all(
      Object.entries(SYSTEM_ACCOUNT_EMAILS).map(async ([accountType, email]) => {
        const account = accountMap.get(email);
        
        if (!account) {
          // 🔥 修复：账户不存在时，差异为0，应该视为平衡
          return {
            accountType,
            email,
            currentBalance: 0,
            transactionSum: 0,
            difference: 0,
            hasAccount: false,
            isBalanced: true, // 🔥 修复：账户不存在且差异为0，视为平衡
          };
        }

        // 统计该账户的所有 transactions 总和
        const transactions = await prisma.transactions.findMany({
          where: {
            userId: account.id,
          },
          select: {
            amount: true,
          },
        });

        const transactionSum = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
        const currentBalance = Number(account.balance);
        const difference = Math.abs(currentBalance - transactionSum);

        return {
          accountType,
          email,
          currentBalance,
          transactionSum,
          difference,
          hasAccount: true,
          isBalanced: difference <= 0.01, // 允许 0.01 的误差
        };
      })
    );

    // 3. 计算总体对账结果
    const totalCurrentBalance = reconciliationResults.reduce(
      (sum, result) => sum + result.currentBalance,
      0
    );
    const totalTransactionSum = reconciliationResults.reduce(
      (sum, result) => sum + result.transactionSum,
      0
    );
    const totalDifference = Math.abs(totalCurrentBalance - totalTransactionSum);
    const isOverallBalanced = totalDifference <= 0.01;

    // 4. 检查是否有异常
    // 🔥 修复：只检查存在的账户，且差异 > 0.01 才算异常
    const hasAnomaly = reconciliationResults.some(result => 
      result.hasAccount && !result.isBalanced
    ) || !isOverallBalanced;

    return NextResponse.json({
      success: true,
      data: {
        accounts: reconciliationResults,
        summary: {
          totalCurrentBalance,
          totalTransactionSum,
          totalDifference,
          isOverallBalanced,
          hasAnomaly,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ [System Accounts Reconcile API] 对账失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reconcile system accounts' },
      { status: 500 }
    );
  }
}

