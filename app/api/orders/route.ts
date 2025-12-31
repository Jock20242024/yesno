import { NextResponse } from 'next/server';
import { DBService } from '@/lib/dbService';
import { MarketStatus, Outcome } from '@/types/data';
import { requireAuth } from '@/lib/auth/utils';
import { prisma } from '@/lib/prisma';
import { TransactionType, TransactionStatus, PositionStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

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
  return await prisma.user.findUnique({ 
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
    // 🔥 使用统一的 NextAuth 认证
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
    console.log('🔍 [Orders API] 接收到请求数据:', {
      marketId,
      outcomeSelection,
      amount,
      orderType,
      limitPrice,
      amountType: typeof amount,
      orderTypeType: typeof orderType,
      limitPriceType: typeof limitPrice,
    });

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
    console.log('🔍 [Orders API] ========== 开始处理下注请求 ==========');
    console.log('🔍 [Orders API] 接收到的市场ID:', { 
      marketId, 
      marketIdType: typeof marketId, 
      marketIdLength: marketId?.length,
      isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(marketId || '')
    });
    
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
    console.log('💾 [Orders API] 准备调用 DBService.findMarketById:', marketId);
    const market = await DBService.findMarketById(marketId);
    console.log('💾 [Orders API] DBService.findMarketById 返回结果:', {
      found: !!market,
      marketId: market?.id,
      marketTitle: market?.title,
      marketStatus: market?.status,
    });
    
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
    
    // 将金额转换为整数（分）进行计算
    const amountCents = Math.round(amountNum * PRECISION_MULTIPLIER);
    const feeDeductedCents = Math.round(amountNum * market.feeRate * PRECISION_MULTIPLIER);
    const netAmountCents = amountCents - feeDeductedCents;
    
    // 计算手续费（用于返回）
    const feeDeducted = amountNum * market.feeRate;
    const netAmount = amountNum - feeDeducted;
    
    // 🔥 获取系统账户（在事务外检查，避免事务内查询失败）
    // 如果账户不存在，自动创建（使用 upsert 确保原子性）
    let feeAccount = await getSystemUser(SYSTEM_ACCOUNT_EMAILS.FEE);
    let ammAccount = await getSystemUser(SYSTEM_ACCOUNT_EMAILS.AMM);

    // 🔥 如果系统账户不存在，自动创建
    if (!feeAccount) {
      console.log('⚠️ [Orders API] 手续费账户不存在，自动创建...');
      feeAccount = await prisma.user.create({
        data: {
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
      console.log('✅ [Orders API] 手续费账户已创建:', feeAccount.id);
    }

    if (!ammAccount) {
      console.log('⚠️ [Orders API] AMM 资金池账户不存在，自动创建...');
      ammAccount = await prisma.user.create({
        data: {
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
      console.log('✅ [Orders API] AMM 资金池账户已创建:', ammAccount.id);
    }

    // 使用 Prisma 事务确保原子性
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 🔥 1. 资金划转：用户扣除总金额，系统账户增加对应金额
        const userBalanceCents = Math.round(user.balance * PRECISION_MULTIPLIER);
        const newBalanceCents = userBalanceCents - amountCents;
        
        if (newBalanceCents < 0) {
          throw new Error('Insufficient balance');
        }
        
        const newBalance = newBalanceCents / PRECISION_MULTIPLIER;
        
        // 更新用户余额
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { balance: newBalance },
        });

        // 🔥 更新手续费账户余额（增加手续费）
        const feeAccountBalanceCents = Math.round(feeAccount.balance * PRECISION_MULTIPLIER);
        const newFeeBalanceCents = feeAccountBalanceCents + feeDeductedCents;
        const newFeeBalance = newFeeBalanceCents / PRECISION_MULTIPLIER;

        await tx.user.update({
          where: { id: feeAccount.id },
          data: { balance: newFeeBalance },
        });

        // 🔥 更新 AMM 资金池余额（增加净投资额）
        // 注意：对于 LIMIT 订单，资金也会先转入 AMM 池，但 Market 的 totalYes/totalNo 不更新（直到订单成交）
        const ammAccountBalanceCents = Math.round(ammAccount.balance * PRECISION_MULTIPLIER);
        const newAmmBalanceCents = ammAccountBalanceCents + netAmountCents;
        const newAmmBalance = newAmmBalanceCents / PRECISION_MULTIPLIER;

        await tx.user.update({
          where: { id: ammAccount.id },
          data: { balance: newAmmBalance },
        });
        
        // 🔥 2. 根据订单类型决定是否更新 Market 并计算份额
        // 🔥 核心架构升级：只有 MARKET 订单才更新 Market（因为 LIMIT 订单还未成交）
        let updatedMarket = market;
        let calculatedShares = 0; // 🔥 用于 MARKET 订单：实际成交的份额数
        let executionPrice = 0; // 🔥 实际成交价格（用于 Position 的 avgPrice）
        
        if (validOrderType === 'MARKET') {
          // MARKET 订单：先计算成交价格和份额，然后更新 Market
          // 计算当前市场价格（基于更新前的 Market 状态）
          const currentTotalYes = market.totalYes || 0;
          const currentTotalNo = market.totalNo || 0;
          const currentTotalVolume = currentTotalYes + currentTotalNo;
          
          // 🔥 修复：空池处理（参考 Polymarket 设计，允许在空池中交易）
          // 如果市场总交易量为 0，使用默认价格 0.5（50%）
          if (currentTotalVolume <= 0) {
            console.log('⚠️ [Orders API] 市场总交易量为 0，使用默认价格 0.5');
            executionPrice = 0.5; // 默认价格 50%
          } else {
            // 🔥 实际成交价格（基于更新前的 Market 状态，这是用户实际买入的价格）
            executionPrice = outcomeSelection === Outcome.YES
              ? (currentTotalYes / currentTotalVolume)
              : (currentTotalNo / currentTotalVolume);
          }
          
          // 🔥 修复：防止价格为 0 或无效值
          if (executionPrice <= 0 || !isFinite(executionPrice)) {
            throw new Error(`Invalid market price calculated: ${executionPrice}`);
          }
          
          // 🔥 计算获得的份额（使用实际成交价格）
          calculatedShares = netAmount / executionPrice;
          
          // 🔥 修复：验证份额计算是否有效
          if (!isFinite(calculatedShares) || calculatedShares <= 0) {
            throw new Error(`Invalid shares calculated: ${calculatedShares}`);
          }
          
          // 然后更新 Market 的交易量和价格
          // 🔥 修复：只更新 internalVolume（内部交易量），不覆盖 externalVolume
          const marketInternalVolumeCents = Math.round((market.internalVolume || 0) * PRECISION_MULTIPLIER);
          const marketTotalYesCents = Math.round(market.totalYes * PRECISION_MULTIPLIER);
          const marketTotalNoCents = Math.round(market.totalNo * PRECISION_MULTIPLIER);
          
          // 内部交易量累加（只累加用户下注的金额）
          const newInternalVolumeCents = marketInternalVolumeCents + amountCents;
          const newInternalVolume = newInternalVolumeCents / PRECISION_MULTIPLIER;
          
          const newTotalYesCents = outcomeSelection === Outcome.YES 
            ? marketTotalYesCents + netAmountCents
            : marketTotalYesCents;
          const newTotalNoCents = outcomeSelection === Outcome.NO 
            ? marketTotalNoCents + netAmountCents
            : marketTotalNoCents;
          
          const newTotalYes = newTotalYesCents / PRECISION_MULTIPLIER;
          const newTotalNo = newTotalNoCents / PRECISION_MULTIPLIER;
          
          // 🔥 同时更新 totalVolume 保持向后兼容（使用 calculateDisplayVolume 计算）
          const { calculateDisplayVolume } = await import('@/lib/marketUtils');
          const displayVolume = calculateDisplayVolume({
            source: market.source || 'INTERNAL',
            externalVolume: market.externalVolume || 0,
            internalVolume: newInternalVolume,
            manualOffset: market.manualOffset || 0,
          });
          
          updatedMarket = await tx.market.update({
            where: { id: marketId },
            data: {
              internalVolume: newInternalVolume, // 🔥 只更新内部交易量
              totalVolume: displayVolume, // 更新展示交易量（向后兼容）
              totalYes: newTotalYes,
              totalNo: newTotalNo,
            },
          });
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
        console.log('🔍 [Orders API] 准备创建订单:', {
          orderType: validOrderType,
          status: safeOrderStatus,
          limitPrice: orderData.limitPrice,
          amount: safeAmount,
          filledAmount: safeFilledAmount,
          calculatedShares: validOrderType === 'MARKET' ? calculatedShares : 'N/A (LIMIT order)',
          feeDeducted: safeFeeDeducted,
          userId: userId,
          marketId: marketId,
          outcomeSelection: outcomeSelection,
        });

        const newOrder = await tx.order.create({
          data: orderData,
        });

        // 🔥 2. 记录 Transaction 流水（三条记录）
        // 2.1 用户交易记录：扣除总金额
        await tx.transaction.create({
          data: {
            userId: userId,
            amount: -amountNum, // 负数表示扣除
            type: TransactionType.BET,
            reason: `Buy ${outcomeSelection} on ${market.title} (Order: ${orderId})`,
            status: TransactionStatus.COMPLETED,
          },
        });

        // 2.2 手续费账户收入记录
        await tx.transaction.create({
          data: {
            userId: feeAccount.id,
            amount: feeDeducted, // 正数表示收入
            type: TransactionType.ADMIN_ADJUSTMENT, // 使用 ADMIN_ADJUSTMENT 表示系统账户调整
            reason: `Fee income from Order ${orderId} (Market: ${market.title})`,
            status: TransactionStatus.COMPLETED,
          },
        });

        // 2.3 AMM 资金池存入记录
        await tx.transaction.create({
          data: {
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
        
        if (validOrderType === 'MARKET') {
          // ========== MARKET 订单：立即成交，创建 Position ==========
          // 🔥 注意：calculatedShares 和 executionPrice 已经在步骤 2 中计算完成
          // 🔥 executionPrice 是基于更新前的 Market 状态计算的，这是用户实际成交的价格
          // 查询是否已存在OPEN Position
          const existingPosition = await tx.position.findFirst({
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
            
            updatedPosition = await tx.position.update({
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
            updatedPosition = await tx.position.create({
              data: {
                id: positionId,
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
        };
      });
      
      const { updatedUser, updatedMarket, newOrder, updatedPosition } = result;
      
      console.log('✅ [Orders API] 事务执行成功:', {
        orderId: newOrder.id,
        userId: updatedUser.id,
        updatedBalance: updatedUser.balance,
        marketId: updatedMarket.id,
        orderType: newOrder.orderType,
        status: newOrder.status,
        limitPrice: newOrder.limitPrice,
        filledAmount: newOrder.filledAmount,
        hasPosition: !!updatedPosition,
        newTotalVolume: updatedMarket.totalVolume,
      });
      
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

