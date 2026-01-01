"use server";

import { prisma } from "@/lib/prisma";
import { TransactionType, TransactionStatus } from "@prisma/client";

export interface AssetStats {
  totalUserBalance: number; // 总用户余额
  totalDeposits: number;    // 总充值金额
  totalWithdrawals: number; // 总提现金额
}

/**
 * 获取平台资产统计数据
 * 统计：总用户余额、总充值、总提现
 */
export async function getAssetStats(): Promise<AssetStats> {
  try {
    // 1. 计算总用户余额：User 表中所有 balance 的总和
    const totalBalanceResult = await prisma.users.aggregate({
      _sum: {
        balance: true,
      },
    });
    const totalUserBalance = totalBalanceResult._sum.balance ?? 0;

    // 2. 计算总充值金额：Transaction 表中 type = 'DEPOSIT' 且 status = 'COMPLETED' 的金额总和
    const depositsResult = await prisma.transactions.aggregate({
      where: {
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
      },
      _sum: {
        amount: true,
      },
    });
    const totalDeposits = depositsResult._sum.amount ?? 0;

    // 3. 计算总提现金额：Transaction 表中 type = 'WITHDRAW' 且 status = 'COMPLETED' 的金额总和
    // 注意：由于 amount 可能是负数，我们使用绝对值或者确保统计的是正数
    const withdrawalsResult = await prisma.transactions.aggregate({
      where: {
        type: TransactionType.WITHDRAW,
        status: TransactionStatus.COMPLETED,
      },
      _sum: {
        amount: true,
      },
    });
    // 由于 WITHDRAW 的 amount 可能是负数，我们需要取绝对值
    const totalWithdrawals = Math.abs(withdrawalsResult._sum.amount ?? 0);

    return {
      totalUserBalance,
      totalDeposits,
      totalWithdrawals,
    };
  } catch (error) {
    console.error("Error fetching asset stats:", error);
    // 发生错误时返回默认值
    return {
      totalUserBalance: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
    };
  }
}
