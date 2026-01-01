/**
 * 返佣分发服务
 * 在订单成交后，根据交易量计算并分发返佣给邀请人
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { TransactionType, TransactionStatus } from '@prisma/client';

const REFERRAL_COMMISSION_RATE_KEY = 'REFERRAL_COMMISSION_RATE';

/**
 * 分发返佣给邀请人
 * @param orderId 订单ID
 * @param userId 下单用户ID
 * @param orderAmount 订单金额（交易量）
 * @returns 是否成功分发返佣
 */
export async function distributeCommission(
  orderId: string,
  userId: string,
  orderAmount: number
): Promise<{ success: boolean; commissionAmount?: number; error?: string }> {
  try {
    // 1. 获取下单用户信息，检查是否有邀请人
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { invitedById: true },
    });

    if (!user || !user.invitedById) {
      // 没有邀请人，不需要返佣
      return { success: true };
    }

    // 2. 从数据库读取最新的全局返佣比例
    const rateSetting = await prisma.system_settings.findUnique({
      where: { key: REFERRAL_COMMISSION_RATE_KEY },
    });

    const rate = rateSetting ? parseFloat(rateSetting.value) : 0.01; // 默认 1%
    
    if (rate <= 0) {
      // 返佣比例未设置或为0，不进行返佣
      return { success: true };
    }

    // 3. 计算返佣金额（基于交易量）
    const commissionAmount = orderAmount * rate;

    if (commissionAmount <= 0) {
      return { success: true };
    }

    // 4. 执行转账（原子操作事务）
    await prisma.$transaction(async (tx) => {
      // A. 给邀请人加钱
      await tx.users.update({
        where: { id: user.invitedById! }, // Non-null assertion since we already checked it exists
        data: { balance: { increment: commissionAmount } },
      });

      // B. 记录返佣日志
      await tx.commission_logs.create({
        data: {
          id: randomUUID(),
          beneficiaryId: user.invitedById!, // Non-null assertion since we already checked it exists
          sourceUserId: userId,
          orderId: orderId,
          amount: commissionAmount,
          type: 'TRADING_REBATE',
        },
      });

      // C. 记录邀请人的交易流水
      await tx.transactions.create({
        data: {
          id: randomUUID(),
          userId: user.invitedById!, // Non-null assertion since we already checked it exists
          amount: commissionAmount,
          type: TransactionType.ADMIN_ADJUSTMENT, // 使用 ADMIN_ADJUSTMENT 表示系统返佣
          reason: `Referral commission from Order ${orderId}`,
          status: TransactionStatus.COMPLETED,
        },
      });
    });

    return { success: true, commissionAmount };
  } catch (error: any) {
    console.error('❌ [Commission] 返佣分发失败:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to distribute commission' 
    };
  }
}

