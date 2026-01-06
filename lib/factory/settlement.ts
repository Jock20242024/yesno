/**
 * 🔥 基于本地赔率的统一结算系统 (Unified Settlement System Based on Local Odds)
 * 
 * 🔥 核心设计：统一封装结算逻辑，避免维护两套不一致的代码
 * - 自动结算和手动结算都调用同一个核心函数 executeSettlement
 * - 确保计算结果完全一致
 * 
 * 🔥 新的业务逻辑（不再依赖 externalId 和 Polymarket API）：
 * 1. 工厂市场：从 outcomePrices 自动判定胜负
 * 2. 手动市场：管理员指定 finalOutcome
 * 3. 统一使用订单级别的池子计算（最准确）
 * 4. 更新数据库状态为 RESOLVED 并触发派奖
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { MarketStatus, Outcome } from '@/types/data';

/**
 * 解析 outcomePrices JSON 字符串，提取 YES 和 NO 的价格
 */
function parseOutcomePrices(outcomePricesStr: string | null | undefined): { yesPrice: number; noPrice: number } | null {
  if (!outcomePricesStr) {
    return null;
  }

  try {
    // outcomePrices 可能是 JSON 字符串，如 "[\"0.7\", \"0.3\"]" 或 ["0.7", "0.3"]
    let prices: string[] | number[];
    
    if (typeof outcomePricesStr === 'string') {
      prices = JSON.parse(outcomePricesStr);
    } else if (Array.isArray(outcomePricesStr)) {
      prices = outcomePricesStr;
    } else {
      return null;
    }

    // 确保是数组且至少有两个元素
    if (!Array.isArray(prices) || prices.length < 2) {
      return null;
    }

    // 转换为数字
    const yesPrice = parseFloat(String(prices[0]));
    const noPrice = parseFloat(String(prices[1]));

    // 验证价格有效性（应该在 0-1 之间）
    if (isNaN(yesPrice) || isNaN(noPrice) || yesPrice < 0 || yesPrice > 1 || noPrice < 0 || noPrice > 1) {
      return null;
    }

    return { yesPrice, noPrice };
  } catch (error: any) {
    console.error(`❌ [Settlement] 解析 outcomePrices 失败: ${error.message}`);
    return null;
  }
}

/**
 * 🔥 核心结算函数（统一入口）
 * 
 * @param marketId 市场ID
 * @param providedOutcome 可选：管理员指定的结算结果（用于手动结算）
 * @returns 结算结果
 */
export async function executeSettlement(
  marketId: string,
  providedOutcome?: Outcome | 'YES' | 'NO'
): Promise<{
  success: boolean;
  outcome: Outcome | null;
  statistics?: {
    totalOrders: number;
    winningOrders: number;
    totalPayout: number;
    affectedUsers: number;
  };
  error?: string;
}> {
  try {
    // 🔥 性能优化：删除高频日志（结算扫描每30秒执行一次）
    // console.log(`⚖️ [Settlement] 开始结算市场: ${marketId}`);

    // 1. 获取市场信息（包含流动性数据）
    const market = await prisma.markets.findUnique({
      where: { id: marketId },
      select: {
        id: true,
        title: true,
        status: true,
        outcomePrices: true,
        isFactory: true,
        closingDate: true,
        resolvedOutcome: true,
        totalYes: true, // 🔥 新增：用于计算初始流动性
        totalNo: true,  // 🔥 新增：用于计算初始流动性
      },
    });

    if (!market) {
      return {
        success: false,
        outcome: null,
        error: '市场不存在',
      };
    }

    // 2. 检查市场状态
    if (market.status === MarketStatus.RESOLVED) {
      return {
        success: false,
        outcome: market.resolvedOutcome as Outcome | null,
        error: '市场已经结算过了',
      };
    }

    // 3. 判定胜负
    let finalOutcome: Outcome | null = null;

    if (providedOutcome) {
      // 如果管理员指定了结果，直接使用
      finalOutcome = providedOutcome as Outcome;

    } else if (market.isFactory) {
      // 工厂市场：从 outcomePrices 自动判定
      if (!market.outcomePrices) {
        // 🔥 如果市场已过期很久（超过1小时）且没有赔率数据，标记为需要人工处理
        const hoursSinceEnd = (Date.now() - new Date(market.closingDate).getTime()) / (1000 * 60 * 60);
        if (hoursSinceEnd > 1) {
          console.warn(`⚠️ [Settlement] 市场 ${marketId} 已过期 ${hoursSinceEnd.toFixed(1)} 小时且没有赔率数据，标记为需要人工处理`);
          await prisma.markets.update({
            where: { id: marketId },
            data: {
              status: MarketStatus.CLOSED,
              resolvedOutcome: null,
            },
          });
        }
        return {
          success: false,
          outcome: null,
          error: '工厂市场没有赔率数据（outcomePrices），无法自动结算。请等待赔率同步或手动结算',
        };
      }

      const prices = parseOutcomePrices(market.outcomePrices);
      if (!prices) {
        return {
          success: false,
          outcome: null,
          error: '无法解析赔率数据（outcomePrices 格式错误）',
        };
      }

      // 判定胜负
      const priceDiff = Math.abs(prices.yesPrice - prices.noPrice);
      const PRICE_THRESHOLD = 0.05; // 价格差值阈值

      if (priceDiff < PRICE_THRESHOLD) {
        // 价格极度接近，需要人工处理
        console.warn(`⚠️ [Settlement] 市场 ${marketId} 的 YES 和 NO 价格极度接近（差值=${priceDiff.toFixed(3)}），需要人工处理`);
        await prisma.markets.update({
          where: { id: marketId },
          data: {
            status: MarketStatus.CLOSED,
            resolvedOutcome: null,
          },
        });
        return {
          success: false,
          outcome: null,
          error: `价格极度接近（差值=${priceDiff.toFixed(3)}），需要管理员手动指定结果`,
        };
      } else if (prices.yesPrice > prices.noPrice) {
        finalOutcome = Outcome.YES;
        // 🔥 性能优化：删除高频日志
        // console.log(`✅ [Settlement] 市场 ${marketId} 判定为 YES 胜`);
      } else {
        finalOutcome = Outcome.NO;
        // 🔥 性能优化：删除高频日志
        // console.log(`✅ [Settlement] 市场 ${marketId} 判定为 NO 胜`);
      }
    } else {
      // 手动市场：必须由管理员指定结果
      return {
        success: false,
        outcome: null,
        error: '手动市场必须由管理员指定结算结果（finalOutcome）',
      };
    }

    // 4. 获取所有订单
    const orders = await prisma.orders.findMany({
      where: { marketId: marketId },
    });

    // 5. 如果没有订单，直接标记为已结算
    if (orders.length === 0) {
      // 🔥 性能优化：删除高频日志
      // console.log(`ℹ️ [Settlement] 市场 ${marketId} 没有订单，直接标记为已结算`);
      await prisma.$transaction(async (tx) => {
        // 🔥 修复：即使没有订单，也要关闭所有 Position
        const allPositions = await tx.positions.findMany({
          where: {
            marketId: marketId,
            status: 'OPEN',
          },
        });

        for (const position of allPositions) {
          await tx.positions.update({
            where: { id: position.id },
            data: {
              status: 'CLOSED',
            },
          });

        }

        await tx.markets.update({
          where: { id: marketId },
          data: {
            status: MarketStatus.RESOLVED,
            resolvedOutcome: finalOutcome,
          },
        });
      });
      return {
        success: true,
        outcome: finalOutcome,
        statistics: {
          totalOrders: 0,
          winningOrders: 0,
          totalPayout: 0,
          affectedUsers: 0,
        },
      };
    }

    // 6. 有订单，需要分发奖金（基于订单级别计算，最准确）
    // 计算总池和获胜池
    let totalPool = 0;
    let winningPool = 0;

    for (const order of orders) {
      const netAmount = order.amount - (order.feeDeducted || 0);
      totalPool += netAmount;

      if (order.outcomeSelection === finalOutcome) {
        winningPool += netAmount;
      }
    }

    // 7. 计算回报并更新订单（在事务中执行）
    const userPayouts = new Map<string, number>();
    let totalPayout = 0;
    let winningOrdersCount = 0;

    // 预先计算所有订单的payout（不写入数据库）
    const orderPayouts = new Map<string, number>();
    for (const order of orders) {
      if (order.outcomeSelection === finalOutcome) {
        // 订单获胜，计算回报金额
        const netInvestment = order.amount - (order.feeDeducted || 0);
        let payout = 0;

        if (winningPool > 0 && totalPool > 0) {
          // 计算回报率：总池 / 获胜池
          const payoutRate = totalPool / winningPool;
          payout = netInvestment * payoutRate;
        }

        // 累计用户回报
        const currentPayout = userPayouts.get(order.userId) || 0;
        userPayouts.set(order.userId, currentPayout + payout);

        totalPayout += payout;
        winningOrdersCount++;
        orderPayouts.set(order.id, payout);
      } else {
        // 订单失败，回报为0
        orderPayouts.set(order.id, 0);
      }
    }

    // 8. 🔥 使用事务确保所有操作的原子性（订单更新、余额更新、Position状态更新、Transaction记录、市场状态更新）
    await prisma.$transaction(async (tx) => {
      // 批量更新订单 payout
      for (const order of orders) {
        const payout = orderPayouts.get(order.id) || 0;
        await tx.orders.update({
          where: { id: order.id },
          data: { payout },
        });
      }

      // 🔥 修复：更新所有 Position 的状态（赢家和输家都设为 CLOSED）
      const allPositions = await tx.positions.findMany({
        where: {
          marketId: marketId,
          status: 'OPEN', // 只更新 OPEN 状态的持仓
        },
      });

      for (const position of allPositions) {
        // 无论输赢，都将 Position 状态设为 CLOSED
        await tx.positions.update({
          where: { id: position.id },
          data: {
            status: 'CLOSED',
          },
        });

      }

      // 批量更新用户余额并创建 Transaction 记录
      for (const [userId, payout] of userPayouts.entries()) {
        if (payout > 0) {
          // 更新用户余额
          await tx.users.update({
            where: { id: userId },
            data: {
              balance: {
                increment: payout,
              },
            },
          });

          // 🔥 修复：创建 Transaction 记录记录奖金发放
          await tx.transactions.create({
            data: {
              id: randomUUID(),
              userId: userId,
              amount: payout,
              type: 'WIN', // 使用 WIN 类型表示结算奖金
              reason: `市场 ${marketId} 结算奖金（${finalOutcome} 胜）`,
              status: 'COMPLETED',
            },
          });

        }
      }

      // 🔥 新增：流动性回收逻辑（将"死钱"变回"活水"）
      // 1. 计算市场的实际占用AMM余额（包括点差收益）
      // 🔥 修复：回收该市场实际占用的所有AMM余额（totalYes + totalNo），而不仅仅是initialLiquidity
      // 这样才能确保点差收益也被回收，避免残留在AMM账户
      const marketWithLiquidity = await tx.markets.findUnique({
        where: { id: marketId },
        select: {
          totalYes: true,
          totalNo: true,
          initialLiquidity: true, // 用于记录初始注入金额（用于盈亏计算）
        },
      });
      
      // 实际占用的AMM余额 = 当前市场的totalYes + totalNo（包括点差收益）
      const actualAmmBalance = Number(marketWithLiquidity?.totalYes || 0) + Number(marketWithLiquidity?.totalNo || 0);
      const initialLiquidity = marketWithLiquidity?.initialLiquidity 
        ? Number(marketWithLiquidity.initialLiquidity)
        : actualAmmBalance; // 如果没有记录initialLiquidity，使用实际余额作为初始值
      
      // 2. 如果市场有实际占用余额，执行回收
      if (actualAmmBalance > 0) {
        // 获取系统账户
        const ammAccount = await tx.users.findFirst({
          where: { email: 'system.amm@yesno.com' },
        });
        
        const liquidityAccount = await tx.users.findFirst({
          where: { email: 'system.liquidity@yesno.com' },
        });
        
        if (ammAccount && liquidityAccount) {
          // 3. 计算回收金额
          // 🔥 修复：回收金额 = 该市场实际占用的AMM余额（totalYes + totalNo）
          // 这包括初始注入金额 + 点差收益，确保所有资金都被回收
          const currentAmmBalance = Number(ammAccount.balance);
          // 回收金额不能超过AMM账户当前余额（防止其他市场占用导致余额不足）
          const recoverableAmount = Math.min(actualAmmBalance, currentAmmBalance);
          
          if (recoverableAmount > 0) {
            // 4. 执行资金划转：从AMM账户扣减，转回流动性账户
            await tx.users.update({
              where: { id: ammAccount.id },
              data: {
                balance: {
                  decrement: recoverableAmount,
                },
              },
            });
            
            await tx.users.update({
              where: { id: liquidityAccount.id },
              data: {
                balance: {
                  increment: recoverableAmount,
                },
              },
            });
            
            // 5. 创建Transaction记录（AMM账户：支出）
            await tx.transactions.create({
              data: {
                id: randomUUID(),
                userId: ammAccount.id,
                amount: -recoverableAmount,
                type: 'LIQUIDITY_RECOVERY',
                reason: `市场 ${marketId} 结算后流动性回收 - 实际占用: $${actualAmmBalance.toFixed(2)}, 初始注入: $${initialLiquidity.toFixed(2)}, 回收金额: $${recoverableAmount.toFixed(2)}`,
                status: 'COMPLETED',
              },
            });
            
            // 6. 创建Transaction记录（流动性账户：收入）
            await tx.transactions.create({
              data: {
                id: randomUUID(),
                userId: liquidityAccount.id,
                amount: recoverableAmount,
                type: 'LIQUIDITY_RECOVERY',
                reason: `市场 ${marketId} 结算后流动性回收 - 实际占用: $${actualAmmBalance.toFixed(2)}, 初始注入: $${initialLiquidity.toFixed(2)}, 回收金额: $${recoverableAmount.toFixed(2)}`,
                status: 'COMPLETED',
              },
            });
            
            // 7. 计算做市盈亏
            // 做市盈亏 = 回收金额 - 初始注入金额
            // 如果回收金额 > 初始注入金额，说明盈利（点差收益）
            // 如果回收金额 < 初始注入金额，说明亏损（坏账）
            const marketProfitLoss = recoverableAmount - initialLiquidity;
            
            if (Math.abs(marketProfitLoss) > 0.01) {
              // 8. 记录做市盈亏（只有盈亏超过0.01才记录，避免精度误差）
              await tx.transactions.create({
                data: {
                  id: randomUUID(),
                  userId: ammAccount.id,
                  amount: marketProfitLoss,
                  type: 'MARKET_PROFIT_LOSS',
                  reason: `市场 ${marketId} 做市盈亏（${finalOutcome} 胜） - 初始注入: $${initialLiquidity.toFixed(2)}, 回收: $${recoverableAmount.toFixed(2)}, 盈亏: $${marketProfitLoss > 0 ? '+' : ''}${marketProfitLoss.toFixed(2)}`,
                  status: 'COMPLETED',
                },
              });
            }
          } else if (initialLiquidity > 0 && currentAmmBalance <= 0) {
            // 🔥 特殊情况：如果AMM余额不足（可能被其他市场占用或已亏损），记录坏账
            const badDebt = initialLiquidity;
            await tx.transactions.create({
              data: {
                id: randomUUID(),
                userId: ammAccount.id,
                amount: -badDebt,
                type: 'MARKET_PROFIT_LOSS',
                reason: `市场 ${marketId} 结算后坏账 - 初始注入: $${initialLiquidity.toFixed(2)}, AMM余额不足，无法回收`,
                status: 'COMPLETED',
              },
            });
          }
        }
      }
      
      // 更新市场状态并清零流动性数据
      await tx.markets.update({
        where: { id: marketId },
        data: {
          status: MarketStatus.RESOLVED,
          resolvedOutcome: finalOutcome,
          totalYes: 0, // 🔥 清零流动性数据
          totalNo: 0,  // 🔥 清零流动性数据
        },
      });
    });

    const statistics = {
      totalOrders: orders.length,
      winningOrders: winningOrdersCount,
      totalPayout,
      affectedUsers: userPayouts.size,
    };

    return {
      success: true,
      outcome: finalOutcome,
      statistics,
    };
  } catch (error: any) {
    console.error(`❌ [Settlement] 结算市场 ${marketId} 失败:`, error.message);
    return {
      success: false,
      outcome: null,
      error: error.message,
    };
  }
}

/**
 * 🔥 自动结算扫描器（定期运行）
 * 识别状态为 OPEN 且已过结束时间超过 10 分钟的市场并自动结算
 */
export async function runSettlementScanner(): Promise<{
  scanned: number;
  settled: number;
  errors: number;
}> {
  const stats = {
    scanned: 0,
    settled: 0,
    errors: 0,
  };

  try {

    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000); // 10分钟前

    // 🔥 查询所有已过结束时间超过 10 分钟且尚未结算的工厂市场
    // 修复：不再限制状态为 OPEN，包括所有非 RESOLVED/CANCELED 的状态（OPEN, CLOSED, PENDING 等）
    const marketsToSettle = await prisma.markets.findMany({
      where: {
        isFactory: true,
        status: {
          notIn: [MarketStatus.RESOLVED, MarketStatus.CANCELED], // 🔥 包括所有非已结算/已取消的状态
        },
        closingDate: {
          lte: tenMinutesAgo, // 结束时间 <= 10分钟前（即已过期超过10分钟）
        },
        resolvedOutcome: null, // 尚未结算
      },
      select: {
        id: true,
      },
    });

    stats.scanned = marketsToSettle.length;

    // 逐个结算（调用统一的核心函数）
    for (const market of marketsToSettle) {
      const result = await executeSettlement(market.id);
      if (result.success) {
        stats.settled++;
      } else {
        stats.errors++;
        console.warn(`⚠️ [Settlement Scanner] 市场 ${market.id} 结算失败: ${result.error}`);
      }
    }

    return stats;
  } catch (error: any) {
    console.error('❌ [Settlement Scanner] 扫描失败:', error);
    throw error;
  }
}
