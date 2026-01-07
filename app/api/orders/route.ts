import { NextResponse } from 'next/server';
import { DBService } from '@/lib/dbService';
import { MarketStatus, Outcome } from '@/types/data';
import { requireAuth } from '@/lib/auth/utils';
import { prisma } from '@/lib/prisma';
import { executeTransaction } from '@/lib/prismaTransaction';
import { TransactionType, TransactionStatus, PositionStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { distributeCommission } from '@/lib/services/commission';

/**
 * 系统账户 Email 配置
 */
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
 * 创建订单 API
 * POST /api/orders
 * 
 * 处理用户下注请求
 * 请求体：
 * - marketId: 市场ID
 * - outcomeSelection: 选择的结果选项 (YES/NO)
 * - amount: 下注金额
 * 
 * 🔥 统一认证：使用 NextAuth 进行身份验证
 */
export async function POST(request: Request) {
  // 🔥 提前解析请求体，避免在错误处理中重复调用
  let requestBody: any = null;
  try {
    requestBody = await request.json();
  } catch (parseError) {
    console.error('🔥 [Orders API] JSON 解析失败（最外层）:', parseError);
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid JSON in request body',
      },
      { status: 400 }
    );
  }

  try {
    // 🔥 使用统一的 NextAuth 认证（支持 Session 和 API Key）
    const authResult = await requireAuth();
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.statusCode }
      );
    }

    const userId = authResult.userId;

    // 使用已解析的请求体
    const body = requestBody;
    const { marketId, outcomeSelection, amount, orderType, limitPrice } = body;
    
    // 🔥 调试日志：打印接收到的原始数据

    // 验证必需字段
    if (!marketId || !outcomeSelection || !amount) {
      return NextResponse.json(
        {
          success: false,
          error: 'marketId, outcomeSelection, and amount are required',
        },
        { status: 400 }
      );
    }

    // 🔥 核心修复：验证 orderType，默认值为 MARKET
    const validOrderType = (orderType === 'LIMIT') ? 'LIMIT' : 'MARKET';
    
    // 🔥 核心修复：只有 LIMIT 订单才需要验证 limitPrice，MARKET 订单不需要
    if (validOrderType === 'LIMIT') {
      // LIMIT 订单必须提供 limitPrice
      if (!limitPrice || isNaN(parseFloat(limitPrice))) {
        return NextResponse.json(
          {
            success: false,
            error: 'limitPrice is required for LIMIT orders',
          },
          { status: 400 }
        );
      }
      const limitPriceNum = parseFloat(limitPrice);
      if (limitPriceNum <= 0 || limitPriceNum >= 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'limitPrice must be between 0 and 1',
          },
          { status: 400 }
        );
      }
    }
    // MARKET 订单不需要 limitPrice，允许为空或未提供

    // 验证 outcomeSelection
    if (outcomeSelection !== 'YES' && outcomeSelection !== 'NO') {
      return NextResponse.json(
        {
          success: false,
          error: 'outcomeSelection must be YES or NO',
        },
        { status: 400 }
      );
    }

    // 验证 amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'amount must be a positive number',
        },
        { status: 400 }
      );
    }

    // 强制 ID 校验：再次确保 API 接收到的市场 ID 是正确的 UUID 格式
    // 查询隔离：检查下注 API 使用的 DBService.findMarketById(...) 确保它在查询市场时使用的是与详情页修复后相同的、正确的逻辑和参数

    // 验证 marketId 格式（应该是 UUID）
    if (!marketId || typeof marketId !== 'string') {
      console.error('❌ [Orders API] 市场ID无效:', marketId);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid marketId format',
        },
        { status: 400 }
      );
    }

    // 业务校验：检查市场是否存在且状态为 OPEN
    // 修复：使用与详情页相同的 DBService.findMarketById 方法

    const market = await DBService.findMarketById(marketId);

    if (!market) {
      console.error('❌ [Orders API] 市场不存在:', marketId);
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

    // 业务校验：检查用户余额
    const user = await DBService.findUserById(userId);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    if (user.balance < amountNum) {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient balance',
        },
        { status: 400 }
      );
    }

    // 原子性与事务：使用数据库事务确保 扣除余额 和 新增持仓记录 的操作是原子性的
    // 防止资金流失或幽灵持仓
    // 浮点数精度：使用高精度计算，将金额转换为整数（分）进行计算，避免浮点数精度问题
    const PRECISION_MULTIPLIER = 100; // 将美元转换为分（cents）
    
    // 🔥 修复：手续费优先级：市场级别手续费优先，如果没有则使用全局手续费
    // 1. 优先使用市场的手续费率（如果市场设置了）
    // 2. 如果市场手续费率为 null 或 0，则使用全局手续费率
    let effectiveFeeRate = market.feeRate || 0;
    
    if (effectiveFeeRate <= 0) {
      // 从 global_stats 表获取全局手续费率
      try {
        const globalFeeRate = await prisma.global_stats.findFirst({
          where: {
            label: 'GLOBAL_FEE_RATE',
            isActive: true,
          },
          select: {
            value: true,
          },
        });
        
        if (globalFeeRate?.value !== undefined && globalFeeRate.value > 0) {
          effectiveFeeRate = globalFeeRate.value;
          console.log(`💰 [Orders API] 使用全局手续费率: ${(effectiveFeeRate * 100).toFixed(2)}%`);
        } else {
          // 如果全局手续费率也未设置，使用默认值 0.05 (5%)
          effectiveFeeRate = 0.05;
          console.log(`💰 [Orders API] 使用默认手续费率: 5%`);
        }
      } catch (error) {
        console.error('❌ [Orders API] 获取全局手续费率失败:', error);
        // 降级：使用默认值 0.05
        effectiveFeeRate = 0.05;
      }
    } else {
      console.log(`💰 [Orders API] 使用市场手续费率: ${(effectiveFeeRate * 100).toFixed(2)}%`);
    }
    
    // 将金额转换为整数（分）进行计算
    const amountCents = Math.round(amountNum * PRECISION_MULTIPLIER);
    const feeDeductedCents = Math.round(amountNum * effectiveFeeRate * PRECISION_MULTIPLIER);
    const netAmountCents = amountCents - feeDeductedCents;
    
    // 计算手续费（用于返回）
    const feeDeducted = amountNum * effectiveFeeRate;
    const netAmount = amountNum - feeDeducted;
    
    // 🔥 获取系统账户（在事务外检查，避免事务内查询失败）
    // 如果账户不存在，自动创建（使用 upsert 确保原子性）
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

    // 🔥 优化：使用统一的事务工具函数，提高交易速度并处理连接问题
    try {
      const result = await executeTransaction(async (tx) => {
        // 🔥 1. 资金划转：用户扣除总金额，系统账户增加对应金额
        const userBalanceCents = Math.round(user.balance * PRECISION_MULTIPLIER);
        const newBalanceCents = userBalanceCents - amountCents;
        
        if (newBalanceCents < 0) {
          throw new Error('Insufficient balance');
        }
        
        const newBalance = newBalanceCents / PRECISION_MULTIPLIER;
        
        // 更新用户余额
        const updatedUser = await tx.users.update({
          where: { id: userId },
          data: { balance: newBalance },
        });

        // 🔥 更新手续费账户余额（增加手续费）
        const feeAccountBalanceCents = Math.round(feeAccount.balance * PRECISION_MULTIPLIER);
        const newFeeBalanceCents = feeAccountBalanceCents + feeDeductedCents;
        const newFeeBalance = newFeeBalanceCents / PRECISION_MULTIPLIER;

        await tx.users.update({
          where: { id: feeAccount.id },
          data: { balance: newFeeBalance },
        });

        // 🔥 更新 AMM 资金池余额（增加净投资额）
        // 注意：对于 LIMIT 订单，资金也会先转入 AMM 池，但 Market 的 totalYes/totalNo 不更新（直到订单成交）
        const ammAccountBalanceCents = Math.round(ammAccount.balance * PRECISION_MULTIPLIER);
        const newAmmBalanceCents = ammAccountBalanceCents + netAmountCents;
        const newAmmBalance = newAmmBalanceCents / PRECISION_MULTIPLIER;

        await tx.users.update({
          where: { id: ammAccount.id },
          data: { balance: newAmmBalance },
        });
        
        // 🔥 2. 根据订单类型决定是否更新 Market 并计算份额
        // 🔥 核心架构升级：只有 MARKET 订单才更新 Market（因为 LIMIT 订单还未成交）
        let updatedMarket = market;
        let calculatedShares = 0; // 🔥 用于 MARKET 订单：实际成交的份额数
        let executionPrice = 0; // 🔥 实际成交价格（用于 Position 的 avgPrice）
        
        if (validOrderType === 'MARKET') {
          // 🔥 混合撮合引擎：MARKET订单使用CPMM恒定乘积公式（Delta中性对冲）
          // 1. 获取市场当前状态
          const currentTotalYes = market.totalYes || 0;
          const currentTotalNo = market.totalNo || 0;
          const currentAmmK = (market as any).ammK || (currentTotalYes * currentTotalNo);
          
          // 2. 使用CPMM计算价格和份额（Delta中性对冲）
          const { calculateCPMMPrice } = await import('@/lib/engine/match');
          const cpmmResult = calculateCPMMPrice(
            currentTotalYes,
            currentTotalNo,
            outcomeSelection as Outcome,
            netAmount
          );
          
          calculatedShares = cpmmResult.shares;
          executionPrice = cpmmResult.executionPrice;
          
          // 3. 更新Market（使用CPMM计算后的新值）
          const marketInternalVolumeCents = Math.round(((market as any).internalVolume || 0) * PRECISION_MULTIPLIER);
          const newInternalVolumeCents = marketInternalVolumeCents + amountCents;
          const newInternalVolume = newInternalVolumeCents / PRECISION_MULTIPLIER;
          
          // 🔥 使用CPMM计算后的新totalYes和totalNo
          const newTotalYes = cpmmResult.newTotalYes;
          const newTotalNo = cpmmResult.newTotalNo;
          const newAmmK = cpmmResult.k;
          
          // 🔥 同时更新 totalVolume 保持向后兼容
          const { calculateDisplayVolume } = await import('@/lib/marketUtils');
          const displayVolume = calculateDisplayVolume({
            source: (market as any).source || 'INTERNAL',
            externalVolume: (market as any).externalVolume || 0,
            internalVolume: newInternalVolume,
            manualOffset: (market as any).manualOffset || 0,
          });
          
          const prismaMarket = await tx.markets.update({
            where: { id: marketId },
            data: {
              internalVolume: newInternalVolume,
              totalVolume: displayVolume,
              totalYes: newTotalYes,
              totalNo: newTotalNo,
              ammK: newAmmK, // 🔥 更新AMM恒定乘积常数
            },
          });
          
          updatedMarket = prismaMarket as any;
          
          // 🔥 4. 记录AMM做市盈亏（Delta中性对冲产生的点差收益）
          // 计算点差收益：用户支付的价格 - AMM成本价格
          const currentTotalVolume = currentTotalYes + currentTotalNo;
          const ammCostPrice = currentTotalVolume > 0
            ? (outcomeSelection === Outcome.YES 
                ? currentTotalYes / currentTotalVolume
                : currentTotalNo / currentTotalVolume)
            : 0.5;
          
          const spreadProfit = (executionPrice - ammCostPrice) * calculatedShares;
          
          // 🔥 修复：将做市盈亏记录移到事务外，避免事务中止后继续执行导致错误
          // 注意：spreadProfit 计算在事务内，但记录在事务外
          // 如果记录失败，不影响订单创建
        } else {
          // LIMIT 订单：不更新 Market（因为还未成交）
          // Market 数据保持不变
          // calculatedShares 保持为 0
        }
        
        // 3. 创建新的 Order 记录
        // 硬编码检查：确保 userId 不是硬编码值，必须使用从 Auth Token 提取的 current_user_id
        if (!userId || typeof userId !== 'string' || userId.trim() === '') {
          throw new Error('Order creation: userId is required and must be extracted from Auth Token');
        }
        
        // 🔥 使用 UUID 格式（与 schema 定义一致：@id @default(uuid())）
        const orderId = randomUUID();
        
        // 🔥 核心架构升级：根据订单类型决定处理逻辑
        // MARKET 订单：立即成交，创建 Position，更新 Market
        // LIMIT 订单：设为 PENDING，不创建 Position，不更新 Market（资金已冻结）
        
        // 🔥 数据清洗：确保状态和填充金额都是有效的
        const safeOrderStatus = validOrderType === 'MARKET' ? 'FILLED' : 'PENDING';
        
        // 🔥 数据清洗：确保所有数据都是有效的，防止 NaN 或 undefined 导致崩溃
        const safeAmount = isNaN(amountNum) || !isFinite(amountNum) || amountNum <= 0 ? 0 : amountNum;
        const safeFeeDeducted = isNaN(feeDeducted) || !isFinite(feeDeducted) || feeDeducted < 0 ? 0 : feeDeducted;
        
        // 🔥 核心修复：filledAmount 存储实际成交的份额数（calculatedShares），而不是订单金额
        const safeFilledAmount = validOrderType === 'MARKET' 
          ? calculatedShares  // MARKET 订单：使用计算出的份额数
          : 0;                 // LIMIT 订单：保持为 0（未成交）
        
        // 🔥 核心修复：根据订单类型设置正确的字段值
        const orderData: any = {
          id: orderId,
          userId: userId, // 强制数据隔离：使用从 Auth Token 提取的 current_user_id
          marketId: marketId,
          outcomeSelection: outcomeSelection as Outcome,
          amount: safeAmount,
          feeDeducted: safeFeeDeducted,
          type: 'BUY',
          status: safeOrderStatus, // 🔥 订单状态：MARKET='FILLED', LIMIT='PENDING'
          orderType: validOrderType, // 🔥 订单类型：'MARKET' 或 'LIMIT'
          filledAmount: safeFilledAmount, // 🔥 已成交数量：MARKET=calculatedShares, LIMIT=0
          updatedAt: new Date(), // 🔥 修复：添加必需的 updatedAt 字段
        };

        // 🔥 核心修复：只有 LIMIT 订单才设置 limitPrice，MARKET 订单必须为 null
        if (validOrderType === 'LIMIT') {
          // LIMIT 订单：必须提供 limitPrice
          if (!limitPrice || isNaN(parseFloat(limitPrice))) {
            throw new Error('limitPrice is required for LIMIT orders');
          }
          const limitPriceNum = parseFloat(limitPrice);
          if (!isFinite(limitPriceNum) || limitPriceNum <= 0 || limitPriceNum >= 1) {
            throw new Error('limitPrice must be between 0 and 1');
          }
          orderData.limitPrice = limitPriceNum;
        } else {
          // MARKET 订单：limitPrice 必须为 null（明确设置为 null）
          orderData.limitPrice = null;
        }

        // 🔥 调试日志：打印即将写入的数据

        const newOrder = await tx.orders.create({
          data: orderData,
        });

        // 🔥 2. 记录 Transaction 流水（三条记录）
        // 🔥 修复：在事务中，如果任何操作失败，立即抛出错误，不要继续执行
        // 2.1 用户交易记录：扣除总金额
        // 🔥 审计日志：记录详细的资金变动信息
        console.log(`💰 [Orders API] 用户 ${userId} 下单 ${orderId}:`, {
          amount: amountNum,
          feeDeducted: feeDeducted,
          netAmount: netAmount,
          outcomeSelection,
          orderType: validOrderType,
          marketId: marketId,
          userBalanceBefore: user.balance,
          userBalanceAfter: newBalance,
        });
        
        await tx.transactions.create({
          data: {
            id: randomUUID(),
            userId: userId,
            amount: -amountNum, // 负数表示扣除
            type: TransactionType.BET as any, // 🔥 临时类型断言：确保枚举值存在
            reason: `Buy ${outcomeSelection} on ${market.title} (Order: ${orderId})`,
            status: TransactionStatus.COMPLETED,
          },
        });

        // 2.2 手续费账户收入记录
        await tx.transactions.create({
          data: {
            id: randomUUID(),
            userId: feeAccount.id,
            amount: feeDeducted, // 正数表示收入
            type: TransactionType.ADMIN_ADJUSTMENT, // 使用 ADMIN_ADJUSTMENT 表示系统账户调整
            reason: `Fee income from Order ${orderId} (Market: ${market.title})`,
            status: TransactionStatus.COMPLETED,
          },
        });

        // 2.3 AMM 资金池存入记录
        await tx.transactions.create({
          data: {
            id: randomUUID(),
            userId: ammAccount.id,
            amount: netAmount, // 正数表示存入
            type: TransactionType.ADMIN_ADJUSTMENT, // 使用 ADMIN_ADJUSTMENT 表示系统账户调整
            reason: `Pool deposit from Order ${orderId} (Market: ${market.title}, Outcome: ${outcomeSelection})`,
            status: TransactionStatus.COMPLETED,
          },
        });
        
        // 🔥 核心架构升级：只有 MARKET 订单才创建 Position 和更新 Market
        let updatedPosition = null;
        let finalMarket = updatedMarket;
        
        // 🔥 保存 calculatedShares 和 executionPrice 用于事务后的做市盈亏记录
        let savedCalculatedShares = calculatedShares;
        let savedExecutionPrice = executionPrice;
        
        if (validOrderType === 'MARKET') {
          // ========== MARKET 订单：立即成交，创建 Position ==========
          // 🔥 注意：calculatedShares 和 executionPrice 已经在步骤 2 中计算完成
          // 🔥 executionPrice 是基于更新前的 Market 状态计算的，这是用户实际成交的价格
          // 查询是否已存在OPEN Position
          const existingPosition = await tx.positions.findFirst({
            where: {
              userId,
              marketId,
              outcome: outcomeSelection as Outcome,
              status: PositionStatus.OPEN, // 🔥 使用枚举值而非字符串
            },
          });
          
          if (existingPosition) {
            // 更新现有Position（加权平均价格）
            // 🔥 使用 executionPrice（实际成交价格）进行加权平均计算
            const newShares = existingPosition.shares + calculatedShares;
            const newAvgPrice = (existingPosition.shares * existingPosition.avgPrice + calculatedShares * executionPrice) / newShares;
            
            // 🔥 新增：详细日志记录，用于调试持仓计算问题
            console.log(`💰 [Orders API] 更新现有持仓:`, {
              marketId,
              outcome: outcomeSelection,
              existingShares: existingPosition.shares,
              existingAvgPrice: existingPosition.avgPrice,
              newOrderShares: calculatedShares,
              newOrderExecutionPrice: executionPrice,
              newTotalShares: newShares,
              newAvgPrice: newAvgPrice,
              // 🔥 验证：检查 shares * avgPrice 是否接近实际投入金额
              costByShares: newShares * newAvgPrice,
              actualInvested: netAmount,
              difference: Math.abs(newShares * newAvgPrice - netAmount),
            });
            
            updatedPosition = await tx.positions.update({
              where: { id: existingPosition.id },
              data: {
                shares: newShares,
                avgPrice: newAvgPrice,
              },
            });
          } else {
            // 创建新Position
            // 🔥 使用 executionPrice（实际成交价格）作为 avgPrice
            // 🔥 使用 UUID 格式（与 schema 定义一致：@id @default(uuid())）
            const positionId = randomUUID();
            
            // 🔥 新增：详细日志记录，用于调试持仓计算问题
            console.log(`💰 [Orders API] 创建新持仓:`, {
              marketId,
              outcome: outcomeSelection,
              shares: calculatedShares,
              avgPrice: executionPrice,
              netAmount: netAmount,
              // 🔥 验证：检查 shares * avgPrice 是否接近实际投入金额
              costByShares: calculatedShares * executionPrice,
              actualInvested: netAmount,
              difference: Math.abs(calculatedShares * executionPrice - netAmount),
            });
            
            updatedPosition = await tx.positions.create({
              data: {
                id: positionId,
                updatedAt: new Date(),
                userId,
                marketId,
                outcome: outcomeSelection as Outcome,
                shares: calculatedShares,
                avgPrice: executionPrice, // 🔥 使用实际成交价格
                status: PositionStatus.OPEN, // 🔥 使用枚举值而非字符串
              },
            });
          }
        } else {
          // ========== LIMIT 订单：挂单状态，不创建 Position，不更新 Market ==========
          // 资金已冻结（在步骤1中已扣除），但 Market 的 totalYes/totalNo 不更新
          // 只有当订单被撮合成交时，才创建 Position 和更新 Market
          // updatedMarket 保持为原始 market 对象（在前面已经设置为 market）
        }
        
        // 🔥 在事务内保存 existingPosition 信息用于日志记录
        let existingPositionInfo = null;
        if (validOrderType === 'MARKET') {
          const existingPos = await tx.positions.findFirst({
            where: {
              userId,
              marketId,
              outcome: outcomeSelection as Outcome,
              status: PositionStatus.OPEN,
            },
            select: {
              shares: true,
              avgPrice: true,
            },
          });
          if (existingPos) {
            existingPositionInfo = {
              shares: existingPos.shares,
              avgPrice: existingPos.avgPrice,
            };
          }
        }

        return {
          updatedUser,
          updatedMarket,
          newOrder: {
            id: newOrder.id,
            userId: newOrder.userId,
            marketId: newOrder.marketId,
            outcomeSelection: newOrder.outcomeSelection as Outcome,
            amount: newOrder.amount,
            payout: newOrder.payout ?? undefined,
            feeDeducted: newOrder.feeDeducted,
            status: newOrder.status,
            orderType: newOrder.orderType,
            limitPrice: newOrder.limitPrice ?? undefined,
            filledAmount: newOrder.filledAmount,
            createdAt: newOrder.createdAt.toISOString(),
          },
          updatedPosition: updatedPosition ? {
            id: updatedPosition.id,
            shares: updatedPosition.shares,
            avgPrice: updatedPosition.avgPrice,
            status: updatedPosition.status,
          } : null,
          // 🔥 保存 calculatedShares 和 executionPrice 用于事务后的做市盈亏记录
          calculatedShares: calculatedShares,
          executionPrice: executionPrice,
          // 🔥 新增：保存订单详情用于日志记录
          orderDetails: {
            netAmount,
            existingPositionBefore: existingPositionInfo,
          },
        };
      });
      
      const { updatedUser, updatedMarket, newOrder, updatedPosition, calculatedShares, executionPrice, orderDetails } = result;

      // 🔥 新增：详细日志记录，用于调试持仓计算问题
      if (validOrderType === 'MARKET' && calculatedShares && executionPrice) {
        console.log(`💰 [Orders API] 订单成交详情:`, {
          orderId: newOrder.id,
          userId,
          marketId,
          outcome: outcomeSelection,
          amount: amountNum,
          feeDeducted,
          netAmount: orderDetails?.netAmount || netAmount,
          calculatedShares,
          executionPrice,
          positionBefore: orderDetails?.existingPositionBefore || null,
          positionAfter: updatedPosition ? {
            shares: updatedPosition.shares,
            avgPrice: updatedPosition.avgPrice,
          } : null,
          // 🔥 验证：shares * avgPrice 应该接近实际投入金额（累计）
          // 注意：这里只验证单笔订单，累计验证需要在所有订单完成后进行
          costByShares: updatedPosition ? updatedPosition.shares * updatedPosition.avgPrice : 0,
          actualInvested: orderDetails?.netAmount || netAmount,
          difference: updatedPosition ? Math.abs(updatedPosition.shares * updatedPosition.avgPrice - (orderDetails?.netAmount || netAmount)) : 0,
        });
      }

      // 🔥 修复：在事务成功后，记录做市盈亏（移到事务外，避免事务中止）
      if (validOrderType === 'MARKET' && updatedMarket && calculatedShares && executionPrice) {
        try {
          const currentTotalYes = market.totalYes || 0;
          const currentTotalNo = market.totalNo || 0;
          const currentTotalVolume = currentTotalYes + currentTotalNo;
          const ammCostPrice = currentTotalVolume > 0
            ? (outcomeSelection === Outcome.YES 
                ? currentTotalYes / currentTotalVolume
                : currentTotalNo / currentTotalVolume)
            : 0.5;
          
          // 使用从事务中返回的值
          const spreadProfit = (executionPrice - ammCostPrice) * calculatedShares;
          
          if (Math.abs(spreadProfit) > 0.01) {
            // 在事务外记录做市盈亏，如果失败不影响订单
            await prisma.transactions.create({
              data: {
                id: randomUUID(),
                userId: ammAccount.id,
                amount: spreadProfit,
                type: 'MARKET_PROFIT_LOSS' as any,
                reason: `AMM做市点差收益 - 市场: ${market.title} (${marketId}), 用户买入: ${outcomeSelection}, 数量: ${calculatedShares.toFixed(4)}, 点差: $${spreadProfit.toFixed(2)}`,
                status: TransactionStatus.COMPLETED,
              },
            }).catch((error: any) => {
              // 如果枚举值不存在或其他错误，记录警告但不影响订单
              console.warn('⚠️ [Orders API] 做市盈亏记录失败（不影响订单）:', error.message);
            });
          }
        } catch (error: any) {
          // 记录错误但不影响订单创建
          console.warn('⚠️ [Orders API] 计算做市盈亏失败（不影响订单）:', error.message);
        }
      }

      // 🔥 返佣分发：只有在 MARKET 订单成交后才分发返佣
      if (validOrderType === 'MARKET' && newOrder.status === 'FILLED') {
        // 异步执行返佣分发（不阻塞响应）
        distributeCommission(newOrder.id, userId, amountNum).catch((error) => {
          // 记录错误但不影响订单创建
          console.error('❌ [Orders API] 返佣分发失败（不影响订单）:', error);
        });
      }
      
      // 🔥 推送订单簿更新事件（仅在MARKET订单成交后，异步执行不阻塞响应）
      if (validOrderType === 'MARKET' && updatedMarket) {
        // 异步执行，不阻塞响应
        (async () => {
          try {
            // 直接使用内部函数获取订单簿数据，避免HTTP请求
            const { prisma } = await import('@/lib/prisma');
            const market = await prisma.markets.findUnique({
              where: { id: marketId },
              select: {
                totalYes: true,
                totalNo: true,
                ammK: true,
              },
            });

            if (market) {
              // 获取PENDING限价单
              const pendingOrders = await prisma.orders.findMany({
                where: {
                  marketId: marketId,
                  status: 'PENDING',
                  orderType: 'LIMIT',
                  limitPrice: { not: null },
                },
                select: {
                  outcomeSelection: true,
                  limitPrice: true,
                  amount: true,
                  filledAmount: true,
                },
              });

              // 构建订单簿数据（简化版，只包含前10档）
              const { calculateAMMDepth } = await import('@/lib/engine/match');
              const ammDepth = calculateAMMDepth(
                Number(market.totalYes || 0),
                Number(market.totalNo || 0),
                [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
              );

              // 转换为订单簿格式
              const asks: any[] = [];
              const bids: any[] = [];
              
              for (const depthPoint of ammDepth.slice(0, 10)) {
                if (depthPoint.depth > 0) {
                  const entry = {
                    price: depthPoint.outcome === Outcome.YES ? depthPoint.price : (1 - depthPoint.price),
                    quantity: depthPoint.depth,
                    total: depthPoint.depth * depthPoint.price,
                    orderCount: -1, // AMM虚拟订单
                  };
                  
                  if (depthPoint.outcome === Outcome.YES) {
                    bids.push(entry);
                  } else {
                    asks.push(entry);
                  }
                }
              }

              const totalLiquidity = Number(market.totalYes || 0) + Number(market.totalNo || 0);
              const currentPrice = totalLiquidity > 0 ? Number(market.totalYes || 0) / totalLiquidity : 0.5;

              // 🔥 修复：重新查询市场数据，确保使用最新的 totalYes/totalNo
              const updatedMarket = await prisma.markets.findUnique({
                where: { id: marketId },
                select: {
                  totalYes: true,
                  totalNo: true,
                  ammK: true,
                },
              });

              if (updatedMarket) {
                // 重新计算AMM深度（使用更新后的市场数据）
                const updatedAmmDepth = calculateAMMDepth(
                  Number(updatedMarket.totalYes || 0),
                  Number(updatedMarket.totalNo || 0),
                  [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
                );

                // 重新转换为订单簿格式
                const updatedAsks: any[] = [];
                const updatedBids: any[] = [];
                
                for (const depthPoint of updatedAmmDepth.slice(0, 5)) {
                  if (depthPoint.depth > 0) {
                    const entry = {
                      price: depthPoint.outcome === Outcome.YES ? depthPoint.price : (1 - depthPoint.price),
                      quantity: depthPoint.depth,
                      total: depthPoint.depth * depthPoint.price,
                      orderCount: -1, // AMM虚拟订单
                    };
                    
                    if (depthPoint.outcome === Outcome.YES) {
                      updatedBids.push(entry);
                    } else {
                      updatedAsks.push(entry);
                    }
                  }
                }

                const updatedTotalLiquidity = Number(updatedMarket.totalYes || 0) + Number(updatedMarket.totalNo || 0);
                const updatedCurrentPrice = updatedTotalLiquidity > 0 ? Number(updatedMarket.totalYes || 0) / updatedTotalLiquidity : 0.5;

                // 推送订单簿更新（使用更新后的市场数据）
                const { triggerOrderbookUpdate } = await import('@/lib/pusher');
                await triggerOrderbookUpdate(marketId, {
                  asks: updatedAsks.slice(0, 5), // 🔥 修复：只推送5档
                  bids: updatedBids.slice(0, 5), // 🔥 修复：只推送5档
                  spread: updatedAsks.length > 0 && updatedBids.length > 0 ? Math.max(0, updatedAsks[0].price - updatedBids[0].price) : 0,
                  currentPrice: updatedCurrentPrice,
                  ammLiquidity: {
                    totalYes: Number(updatedMarket.totalYes || 0),
                    totalNo: Number(updatedMarket.totalNo || 0),
                    k: Number(updatedMarket.ammK || 0),
                  },
                });
              }
            }
          } catch (pusherError) {
            // Pusher推送失败不影响订单创建
            console.error('❌ [Orders API] Pusher推送失败:', pusherError);
          }
        })();
      }
      
      // 返回创建成功的订单信息和更新后的用户余额
      return NextResponse.json({
        success: true,
        message: newOrder.status === 'PENDING' 
          ? 'Limit order created successfully (pending)' 
          : 'Market order filled successfully',
        data: {
          order: newOrder,
          updatedBalance: updatedUser.balance,
          updatedMarket: updatedMarket ? {
            totalVolume: updatedMarket.totalVolume,
            totalYes: updatedMarket.totalYes,
            totalNo: updatedMarket.totalNo,
          } : null,
          position: updatedPosition, // 只有 MARKET 订单才有 Position
        },
      });
    } catch (error: any) {
      // 🔥 详细错误日志：打印完整的错误信息和数据
      console.error('🔥 [Orders API] 下单失败:', error);
      console.error('📦 [Orders API] 尝试写入的数据:', {
        userId,
        marketId,
        amount: amountNum,
        orderType: validOrderType,
        limitPrice: limitPrice || null,
        status: validOrderType === 'MARKET' ? 'FILLED' : 'PENDING',
        outcomeSelection,
      });
      console.error('📋 [Orders API] 错误详情:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: (error as any).code,
        meta: (error as any).meta,
      });
      
      // 处理特定错误
      if (error.message === 'Insufficient balance') {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient balance',
          },
          { status: 400 }
        );
      }
      
      // Prisma 特定错误处理
      if ((error as any).code === 'P2002') {
        console.error('❌ [Orders API] Prisma 唯一约束违反:', (error as any).meta);
        return NextResponse.json(
          {
            success: false,
            error: 'Order already exists',
          },
          { status: 409 }
        );
      }
      
      if ((error as any).code === 'P2003') {
        console.error('❌ [Orders API] Prisma 外键约束违反:', (error as any).meta);
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid reference (user or market not found)',
          },
          { status: 400 }
        );
      }
      
      // 🔥 其他错误：透传详细的 Prisma 错误信息（帮助调试）
      // 🔥 强制透传：无论开发环境还是生产环境，都返回详细错误信息
      return NextResponse.json(
        {
          success: false,
          error: 'Transaction Failed',
          message: error.message || 'Unknown error',
          details: error.message || 'Unknown error',
          prismaCode: (error as any).code || null,
          meta: (error as any).meta || null,
          errorName: error.name || 'Unknown',
          stack: error.stack || null,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    // 🔥 最外层错误捕获：打印完整的错误信息并透传
    console.error('🔥 [Orders API] 请求处理错误（最外层）:', error);
    console.error('📦 [Orders API] 请求参数:', {
      marketId: requestBody?.marketId,
      orderType: requestBody?.orderType,
      amount: requestBody?.amount,
      outcomeSelection: requestBody?.outcomeSelection,
      limitPrice: requestBody?.limitPrice,
    });
    console.error('📋 [Orders API] 错误详情:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: (error as any).code,
      meta: (error as any).meta,
    });
    
    // 🔥 透传详细的错误信息（帮助调试）
    // 🔥 强制透传：无论开发环境还是生产环境，都返回详细错误信息
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message || 'Unknown error',
        details: error.message || 'Unknown error',
        prismaCode: (error as any).code || null,
        meta: (error as any).meta || null,
        errorName: error.name || 'Unknown',
        stack: error.stack || null,
      },
      { status: 500 }
    );
  }
}

