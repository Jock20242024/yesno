import { NextResponse } from 'next/server';
import { MarketStatus, Outcome } from '@/types/data';
import { prisma } from '@/lib/prisma';
import { DBService } from '@/lib/dbService';
import { requireAuth } from '@/lib/auth/utils';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

// 🔥 系统账户配置（与买入 API 保持一致）
const SYSTEM_ACCOUNT_EMAILS = {
  FEE: 'system.fee@yesno.com',        // 手续费账户
  AMM: 'system.amm@yesno.com',        // AMM 资金池
} as const;

/**
 * 获取系统账户 User 对象
 * @param email 系统账户 email
 * @returns User 对象或 null
 */
async function getSystemUser(email: string) {
  return await prisma.users.findUnique({ 
    where: { email },
    select: {
      id: true,
      email: true,
      balance: true,
    },
  });
}

/**
 * 卖出订单 API
 * POST /api/orders/sell
 * 
 * 处理用户卖出持仓请求
 * 请求体：
 * - marketId: 市场ID
 * - outcome: 选择的结果选项 (YES/NO)
 * - shares: 卖出的份额
 */
export async function POST(request: Request) {
  try {
    // 🔥 使用统一的 NextAuth 认证
    const authResult = await requireAuth();
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.statusCode }
      );
    }

    const userId = authResult.userId;

    // 2. 解析请求体
    const body = await request.json();
    const { marketId, outcome, shares } = body;

    // 3. 验证必需字段
    if (!marketId || !outcome || !shares) {
      return NextResponse.json(
        {
          success: false,
          error: 'marketId, outcome, and shares are required',
        },
        { status: 400 }
      );
    }

    // 4. 验证outcome
    if (outcome !== 'YES' && outcome !== 'NO') {
      return NextResponse.json(
        {
          success: false,
          error: 'outcome must be YES or NO',
        },
        { status: 400 }
      );
    }

    // 5. 验证shares
    const sharesNum = parseFloat(shares);
    if (isNaN(sharesNum) || sharesNum <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'shares must be a positive number',
        },
        { status: 400 }
      );
    }

    // 6. 查询市场
    const market = await DBService.findMarketById(marketId);
    if (!market) {
      return NextResponse.json(
        {
          success: false,
          error: 'Market not found',
        },
        { status: 404 }
      );
    }

    if (market.status !== MarketStatus.OPEN) {
      return NextResponse.json(
        {
          success: false,
          error: 'Market is not open for trading',
        },
        { status: 400 }
      );
    }

    // 7. 获取系统账户（在事务外检查，避免事务内查询失败）
    let feeAccount = await getSystemUser(SYSTEM_ACCOUNT_EMAILS.FEE);
    let ammAccount = await getSystemUser(SYSTEM_ACCOUNT_EMAILS.AMM);

    // 🔥 如果系统账户不存在，自动创建
    if (!feeAccount) {

      feeAccount = await prisma.users.create({
        data: {
          id: randomUUID(),
          updatedAt: new Date(),
          email: SYSTEM_ACCOUNT_EMAILS.FEE,
          balance: 0,
          isAdmin: false,
          isBanned: false,
        },
        select: {
          id: true,
          email: true,
          balance: true,
        },
      });

    }

    if (!ammAccount) {

      ammAccount = await prisma.users.create({
        data: {
          id: randomUUID(),
          updatedAt: new Date(),
          email: SYSTEM_ACCOUNT_EMAILS.AMM,
          balance: 0,
          isAdmin: false,
          isBanned: false,
        },
        select: {
          id: true,
          email: true,
          balance: true,
        },
      });

    }

    // 8. 使用事务执行卖出操作
    const PRECISION_MULTIPLIER = 100;
    
    const result = await prisma.$transaction(async (tx) => {
      // 8.1 锁定用户和Position记录
      const user = await tx.users.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // 8.2 查询OPEN Position（带锁）
      const position = await tx.positions.findFirst({
        where: {
          userId,
          marketId,
          outcome: outcome as Outcome,
          status: 'OPEN',
        },
      });

      if (!position) {
        throw new Error('Position not found');
      }

      if (position.shares < sharesNum) {
        throw new Error('Insufficient shares');
      }

      // 8.3 计算当前市场价格（处理空池情况）
      const totalVolume = (market.totalYes || 0) + (market.totalNo || 0);
      let currentPrice: number;
      if (totalVolume <= 0) {
        // 空池：使用默认价格 0.5
        currentPrice = 0.5;
      } else {
        currentPrice = outcome === 'YES'
          ? (market.totalYes / totalVolume)
          : (market.totalNo / totalVolume);
      }

      // 8.4 计算卖出金额（扣除手续费）
      const grossValue = sharesNum * currentPrice;
      const feeRate = market.feeRate || 0.02;
      const feeDeducted = grossValue * feeRate;
      const netReturn = grossValue - feeDeducted;

      // 🔥 8.5 资金划转：从 AMM 池扣除，给用户增加
      const grossValueCents = Math.round(grossValue * PRECISION_MULTIPLIER);
      const netReturnCents = Math.round(netReturn * PRECISION_MULTIPLIER);
      const feeDeductedCents = Math.round(feeDeducted * PRECISION_MULTIPLIER);

      // 8.5.1 更新用户余额（增加净收益）
      const userBalanceCents = Math.round(user.balance * PRECISION_MULTIPLIER);
      const newUserBalanceCents = userBalanceCents + netReturnCents;
      const newUserBalance = newUserBalanceCents / PRECISION_MULTIPLIER;

      const updatedUser = await tx.users.update({
        where: { id: userId },
        data: { balance: newUserBalance },
      });

      // 8.5.2 更新手续费账户余额（增加手续费收入）
      const feeAccountBalanceCents = Math.round(feeAccount.balance * PRECISION_MULTIPLIER);
      const newFeeBalanceCents = feeAccountBalanceCents + feeDeductedCents;
      const newFeeBalance = newFeeBalanceCents / PRECISION_MULTIPLIER;

      await tx.users.update({
        where: { id: feeAccount.id },
        data: { balance: newFeeBalance },
      });

      // 8.5.3 更新 AMM 资金池余额（扣除支付给用户的金额）
      const ammAccountBalanceCents = Math.round(ammAccount.balance * PRECISION_MULTIPLIER);
      // 🔥 检查 AMM 账户余额是否足够（防止穿仓）
      if (ammAccountBalanceCents < grossValueCents) {
        throw new Error(`Insufficient AMM pool balance: ${ammAccount.balance} < ${grossValue}`);
      }
      const newAmmBalanceCents = ammAccountBalanceCents - grossValueCents;
      const newAmmBalance = newAmmBalanceCents / PRECISION_MULTIPLIER;

      await tx.users.update({
        where: { id: ammAccount.id },
        data: { balance: newAmmBalance },
      });

      // 8.6 更新市场池（反向操作）
      // 🔥 修复：只更新 internalVolume（内部交易量），不覆盖 externalVolume
      const marketInternalVolumeCents = Math.round(((market as any).internalVolume || 0) * PRECISION_MULTIPLIER);
      const marketTotalYesCents = Math.round((market.totalYes || 0) * PRECISION_MULTIPLIER);
      const marketTotalNoCents = Math.round((market.totalNo || 0) * PRECISION_MULTIPLIER);

      const newInternalVolumeCents = marketInternalVolumeCents - grossValueCents;
      const newInternalVolume = newInternalVolumeCents / PRECISION_MULTIPLIER;

      const newTotalYesCents = outcome === 'YES'
        ? marketTotalYesCents - netReturnCents
        : marketTotalYesCents;
      const newTotalNoCents = outcome === 'NO'
        ? marketTotalNoCents - netReturnCents
        : marketTotalNoCents;

      const newTotalYes = newTotalYesCents / PRECISION_MULTIPLIER;
      const newTotalNo = newTotalNoCents / PRECISION_MULTIPLIER;

      // 🔥 计算展示交易量（向后兼容）
      const { calculateDisplayVolume } = await import('@/lib/marketUtils');
      const displayVolume = calculateDisplayVolume({
        source: (market as any).source || 'INTERNAL',
        externalVolume: (market as any).externalVolume || 0,
        internalVolume: newInternalVolume,
        manualOffset: (market as any).manualOffset || 0,
      });

      const updatedMarket = await tx.markets.update({
        where: { id: marketId },
        data: {
          internalVolume: newInternalVolume, // 🔥 只更新内部交易量
          totalVolume: displayVolume, // 更新展示交易量（向后兼容）
          totalYes: newTotalYes,
          totalNo: newTotalNo,
        },
      });

      // 8.7 创建Order记录（SELL类型）- 使用 UUID
      const orderId = randomUUID();
      const newOrder = await tx.orders.create({
        data: {
          id: orderId,
          updatedAt: new Date(),
          userId,
          marketId,
          outcomeSelection: outcome as Outcome,
          amount: grossValue, // 总价值
          feeDeducted,
          type: 'SELL',
          status: 'FILLED', // 卖出订单立即成交
          orderType: 'MARKET', // 卖出默认是市价单
          filledAmount: sharesNum, // 已成交份额
        },
      });

      // 8.8 更新Position
      const remainingShares = position.shares - sharesNum;
      const shouldClose = remainingShares <= 0.001;

      const updatedPosition = await tx.positions.update({
        where: { id: position.id },
        data: {
          shares: shouldClose ? 0 : remainingShares,
          status: shouldClose ? 'CLOSED' : 'OPEN',
        },
      });

      // 🔥 8.9 记录流水 (Transaction) - 复式记账
      // 8.9.1 用户流水：收到卖出收益
      await tx.transactions.create({
        data: {
          id: randomUUID(),
          userId: userId,
          type: TransactionType.BET, // 使用 BET 类型表示交易
          amount: netReturn, // 净收益（扣除手续费后）
          status: TransactionStatus.COMPLETED,
          reason: `卖出 ${outcome} ${sharesNum.toFixed(4)} 份额`,
        },
      });

      // 8.9.2 手续费账户流水：收到手续费
      await tx.transactions.create({
        data: {
          id: randomUUID(),
          userId: feeAccount.id,
          type: TransactionType.ADMIN_ADJUSTMENT, // 系统调整类型
          amount: feeDeducted, // 手续费收入
          status: TransactionStatus.COMPLETED,
          reason: `卖出订单手续费: Order ${orderId}`,
        },
      });

      // 8.9.3 AMM 账户流水：支付给用户
      await tx.transactions.create({
        data: {
          id: randomUUID(),
          userId: ammAccount.id,
          type: TransactionType.ADMIN_ADJUSTMENT, // 系统调整类型
          amount: -grossValue, // 负数表示支出
          status: TransactionStatus.COMPLETED,
          reason: `卖出订单支付: Order ${orderId}`,
        },
      });

      return {
        updatedUser,
        updatedMarket,
        newOrder,
        updatedPosition,
        netReturn,
        grossValue,
        feeDeducted,
      };
    });

    return NextResponse.json({
      success: true,
      message: 'Sell order executed successfully',
      data: {
        order: {
          id: result.newOrder.id,
          type: 'SELL',
          shares: sharesNum,
          netReturn: result.netReturn,
        },
        updatedBalance: result.updatedUser.balance,
        updatedMarket: {
          totalVolume: result.updatedMarket.totalVolume,
          totalYes: result.updatedMarket.totalYes,
          totalNo: result.updatedMarket.totalNo,
        },
        position: {
          shares: result.updatedPosition.shares,
          status: result.updatedPosition.status,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ [Sell API] 卖出失败:', error);
    
    // 🔥 详细错误信息透传（无论环境）
    const errorResponse: any = {
      success: false,
      error: error.message || 'Internal server error',
      message: error.message || 'Internal server error',
      details: error.message,
    };

    // 添加 Prisma 错误详情（如果存在）
    if (error.code) {
      errorResponse.prismaCode = error.code;
    }
    if (error.meta) {
      errorResponse.meta = error.meta;
    }
    if (error.name) {
      errorResponse.name = error.name;
    }
    if (error.stack && process.env.NODE_ENV === 'development') {
      errorResponse.stack = error.stack;
    }
    
    if (error.message === 'Position not found' || error.message === 'Insufficient shares' || error.message === 'Insufficient AMM pool balance') {
      return NextResponse.json(errorResponse, { status: 400 });
    }

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
