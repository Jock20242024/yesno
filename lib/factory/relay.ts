/**
 * 🔥 无人值守接力逻辑 (Relay Mode)
 * 监控即将结束的工厂市场，在结束前的 X 秒（取模版配置中的"接力时间"）自动生成下一个周期的盘口
 */

import { prisma } from '@/lib/prisma';
import { createMarketFromTemplate, getNextPeriodTime } from './engine';
import { MarketStatus } from '@/types/data';
import dayjs from '@/lib/dayjs';

/**
 * 检查并执行自动接力
 * 应该在定期任务中调用（如每30秒）
 */
export async function checkAndRelayMarkets(): Promise<{
  success: boolean;
  relayed: number;
  errors: number;
}> {
  const stats = {
    success: false,
    relayed: 0,
    errors: 0,
  };

  try {
    // 🔥 性能优化：删除高频日志（每30秒执行一次）
    // console.log('🔄 [Relay] 开始检查需要接力的市场...');

    const now = new Date();
    const twoMinutesLater = new Date(now.getTime() + 2 * 60 * 1000); // 2分钟后

    // 查找所有工厂生成且即将结束的市场
    // 结束时间在 [now, twoMinutesLater] 区间内
    const marketsToRelay = await prisma.markets.findMany({
      where: {
        isFactory: true,
        status: 'OPEN',
        closingDate: {
          gte: now,
          lte: twoMinutesLater,
        },
      },
      include: {
        market_categories: true,
      },
    });

    // 🔥 性能优化：删除高频日志
    // console.log(`📊 [Relay] 找到 ${marketsToRelay.length} 个需要接力的市场`);

    // 对每个市场执行接力
    for (const market of marketsToRelay) {
      try {
        // 尝试从市场标题中提取模板信息
        // 格式: "BTC/USD 15分钟盘 - MM/DD HH:mm"
        const titleMatch = market.title.match(/^([A-Z]+\/USD)\s+(\d+)(?:分钟|小时|天)/);
        
        if (!titleMatch) {
          console.warn(`⚠️ [Relay] 无法从标题提取模板信息: ${market.title}`);
          stats.errors++;
          continue;
        }

        const symbol = titleMatch[1];
        const periodLabel = titleMatch[2];
        
        // 将周期标签转换为分钟数
        let period = 15; // 默认15分钟
        if (market.title.includes('小时')) {
          period = parseInt(periodLabel) * 60;
        } else if (market.title.includes('天')) {
          period = parseInt(periodLabel) * 1440;
        } else {
          period = parseInt(periodLabel);
        }

        // 查找对应的模板
        const template = await prisma.market_templates.findFirst({
          where: {
            symbol,
            period,
            isActive: true,
            OR: [
              { status: 'ACTIVE' },
              { status: null as any }, // 兼容旧数据
            ],
          },
        });

        if (!template) {
          console.warn(`⚠️ [Relay] 未找到对应模板: ${symbol} ${period}分钟`);
          stats.errors++;
          continue;
        }

        // 检查是否已经创建了下一期的市场
        // 计算下一期的结束时间
        const nextEndTime = getNextPeriodTime(period, market.closingDate);
        
        // 构建搜索条件：标题应包含符号和周期
        const periodLabelSearch = period === 15 ? '15分钟' : period === 60 ? '1小时' : '1天';
        
        const existingNextMarket = await prisma.markets.findFirst({
          where: {
            isFactory: true,
            AND: [
              { title: { contains: symbol } },
              { title: { contains: periodLabelSearch } },
            ],
            closingDate: {
              gte: new Date(nextEndTime.getTime() - 60000), // 允许1分钟误差
              lte: new Date(nextEndTime.getTime() + 60000),
            },
          },
        });

        if (existingNextMarket) {

          continue;
        }

        // 使用模板创建下一期市场
        // 注意：createMarketFromTemplate 已经在 engine.ts 中设置了 isFactory: true

        const newMarketId = await createMarketFromTemplate({
          id: template.id,
          name: template.name,
          symbol: template.symbol,
          period: template.period,
          advanceTime: template.advanceTime,
          oracleUrl: template.oracleUrl,
          isActive: template.isActive,
          status: (template as any).status || (template.isActive ? 'ACTIVE' : 'PAUSED'),
          failureCount: (template as any).failureCount || 0,
        });

        stats.relayed++;
      } catch (error: any) {
        console.error(`❌ [Relay] 接力市场失败 (ID: ${market.id}):`, error);
        stats.errors++;
      }
    }

    stats.success = true;
    // 🔥 性能优化：仅在发生错误或有成功时输出日志
    if (stats.errors > 0 || stats.relayed > 0) {

    }

    return stats;
  } catch (error) {
    console.error('❌ [Relay] 检查接力市场失败:', error);
    throw error;
  }
}

/**
 * 🔥 Relay Engine 主函数（"永不断流"缓冲区检查模式）
 * 
 * 重构要求：
 * 1. 从"被动创建"改为"缓冲区检查"：每次运行时，检查该模版是否至少有一个未来的、状态为 OPEN 的市场
 * 2. 补断流逻辑：如果当前时间已经超过了最新盘口的 advanceTime，且数据库中没有下一期，必须立即生成
 * 3. 不要管上一期结没结算，先让下一期跑起来
 * 4. 对齐时间戳：严格执行 EndTime 对齐到 00/15/30/45 分刻度，确保接力盘口的时间区间无缝连接
 * 
 * 价格抓取：接力生成新盘口时，必须实时调用 Oracle 获取当前最新价格作为新盘口的 $[StrikePrice]
 */
export async function runRelayEngine(): Promise<void> {

  try {
    const now = new Date();
    
    // 查询所有活跃模板（排除已熔断的）
    const activeTemplates = await prisma.market_templates.findMany({
      where: {
        isActive: true,
        status: 'ACTIVE', // 🔥 只处理运行中的模版，排除已熔断的
      },
    });

    for (const template of activeTemplates) {
      try {
        // 🔥 全天候覆盖：检查未来12-24小时是否已预生成足够数量的市场
        const targetHours = 24; // 预生成24小时的市场
        const targetEndTime = new Date(now.getTime() + targetHours * 60 * 60 * 1000);
        
        // 查找未来24小时内的所有市场（不管状态）
        const futureMarkets = await prisma.markets.findMany({
          where: {
            templateId: template.id,
            isFactory: true,
            closingDate: {
              gt: now,
              lte: targetEndTime,
            },
          },
          orderBy: {
            closingDate: 'asc',
          },
        });

        // 🔥 计算需要预生成的市场数量
        const periodMinutes = template.period;
        const marketsPerHour = 60 / periodMinutes; // 每小时的市场数量
        const expectedMarketCount = Math.ceil(targetHours * marketsPerHour); // 期望的市场数量

        // 如果未来市场数量不足，需要批量创建
        if (futureMarkets.length < expectedMarketCount) {

          // 🔥 获取最后一个市场的结束时间（用于计算下一个周期的开始）
          let lastEndTime: Date;
          if (futureMarkets.length > 0) {
            lastEndTime = futureMarkets[futureMarkets.length - 1].closingDate;
          } else {
            // 如果没有未来市场，获取最新的市场（不管状态）或使用当前时间
            const lastMarket = await prisma.markets.findFirst({
              where: {
                templateId: template.id,
                isFactory: true,
              },
              orderBy: {
                closingDate: 'desc',
              },
            });
            
            if (lastMarket) {
              lastEndTime = lastMarket.closingDate;
            } else {
              // 如果完全没有市场，使用对齐后的当前时间作为起点
              const { getNextPeriodTime } = await import('./engine');
              lastEndTime = getNextPeriodTime(periodMinutes);
              lastEndTime.setTime(lastEndTime.getTime() - periodMinutes * 60 * 1000); // 减去一个周期，作为起点
            }
          }
          
          // 🔥 批量创建市场，直到达到目标数量
          const { getNextPeriodTime } = await import('./engine');
          let currentEndTime = new Date(lastEndTime);
          let createdCount = 0;
          const maxBatchSize = 50; // 每次最多创建50个，避免一次性创建过多
          
          while (futureMarkets.length + createdCount < expectedMarketCount && createdCount < maxBatchSize) {
            // 🔥 计算下一个周期的结束时间（确保对齐）
            currentEndTime = getNextPeriodTime(periodMinutes, currentEndTime);
            
            // 检查是否已经超过目标时间
            if (currentEndTime > targetEndTime) {
              break;
            }
            
            // 检查是否已经存在该时间点的市场
            const existingMarket = await prisma.markets.findFirst({
              where: {
                templateId: template.id,
                isFactory: true,
                closingDate: {
                  gte: new Date(currentEndTime.getTime() - 60000), // 允许1分钟误差
                  lte: new Date(currentEndTime.getTime() + 60000),
                },
              },
            });
            
            if (existingMarket) {
              // 如果已存在，移动到下一个周期（基于已存在的市场结束时间）
              currentEndTime = existingMarket.closingDate;
              continue;
            }
            
            // 🔥 创建新市场（传入指定的endTime用于预生成）
            // 注意：预生成的市场状态为OPEN，但只在对应的StartTime才真正开启交易（通过赔率同步来判断）
            try {
              await createMarketFromTemplate({
                id: template.id,
                name: template.name,
                titleTemplate: (template as any).titleTemplate || null,
                // displayTemplate: (template as any).displayTemplate || null, // Not in MarketTemplate interface
                symbol: template.symbol,
                period: template.period,
                categorySlug: (template as any).categorySlug || null,
                advanceTime: template.advanceTime,
                oracleUrl: template.oracleUrl || null,
                seriesId: (template as any).seriesId || null,
                isActive: template.isActive,
                status: (template as any).status || 'ACTIVE',
                failureCount: (template as any).failureCount || 0,
              }, currentEndTime); // 🔥 传入指定的结束时间
              
              createdCount++;

            } catch (createError: any) {
              console.error(`❌ [RelayEngine] 模板 ${template.name} 创建市场失败:`, createError.message);
              // 遇到错误时，暂停批量创建，避免连续失败
              break;
            }
            
            // 移动到下一个周期（currentEndTime已经在上面通过getNextPeriodTime更新了）
          }
          
          if (createdCount > 0) {

          }
          continue;
        }
        
        // 🔥 如果缓冲区充足，检查是否有市场即将开始交易
        const nextMarket = futureMarkets[0];
        if (nextMarket) {
          const timeUntilNextMarket = (nextMarket.closingDate.getTime() - now.getTime()) / 1000;

        }

        // 🔥 补断流逻辑：如果没有未来的OPEN市场，立即检查并创建
        // 获取该模板的最新市场（不管状态，用于计算下一期的EndTime）
        const lastMarket = await prisma.markets.findFirst({
          where: {
            templateId: template.id,
            isFactory: true,
          },
          orderBy: {
            closingDate: 'desc',
          },
        });

        if (!lastMarket) {
          // 如果还没有任何市场，直接创建第一个

          await createMarketFromTemplate({
            id: template.id,
            name: template.name,
            titleTemplate: (template as any).titleTemplate || null,
                // displayTemplate: (template as any).displayTemplate || null, // Not in MarketTemplate interface
            symbol: template.symbol,
            period: template.period,
            categorySlug: (template as any).categorySlug || null,
            advanceTime: template.advanceTime,
            oracleUrl: template.oracleUrl || null,
            seriesId: (template as any).seriesId || null,
            isActive: template.isActive,
            status: (template as any).status || 'ACTIVE',
            failureCount: (template as any).failureCount || 0,
          });
          continue;
        }

        // 🔥 计算下一期的结束时间（使用 engine.ts 中的 getNextPeriodTime，基于当前时间对齐）
        // 关键：确保 EndTime 对齐到 00/15/30/45 分刻度，无缝连接
        const { getNextPeriodTime, getStartTime } = await import('./engine');
        const nextEndTime = getNextPeriodTime(template.period);
        const nextStartTime = getStartTime(nextEndTime, template.period);
        
        // 🔥 验证：确保下一期的 StartTime = 上一期的 EndTime（无缝连接）
        // 如果 lastMarket 的 closingDate 已经是对齐的，nextEndTime 应该正好是 lastMarket.closingDate + period
        const timeGap = nextEndTime.getTime() - lastMarket.closingDate.getTime();
        const expectedGap = template.period * 60 * 1000;
        const gapDiff = Math.abs(timeGap - expectedGap);
        
        if (gapDiff > 60000) { // 允许1分钟误差
          console.warn(`⚠️ [RelayEngine] 模板 ${template.name} 时间间隔异常：上一期结束=${lastMarket.closingDate.toISOString()}, 下一期结束=${nextEndTime.toISOString()}, 间隔=${Math.round(timeGap / 1000 / 60)}分钟（期望${template.period}分钟）`);
        }

        // 检查是否已经创建了下一期的市场（不管状态）
        const existingNextMarket = await prisma.markets.findFirst({
          where: {
            templateId: template.id,
            isFactory: true,
            closingDate: {
              gte: new Date(nextEndTime.getTime() - 60000), // 允许1分钟误差
              lte: new Date(nextEndTime.getTime() + 60000),
            },
          },
        });

        if (existingNextMarket) {

          continue;
        }

        // 🔥 补断流：立即创建下一期市场

        try {
          await createMarketFromTemplate({
            id: template.id,
            name: template.name,
            titleTemplate: (template as any).titleTemplate || null,
                // displayTemplate: (template as any).displayTemplate || null, // Not in MarketTemplate interface
            symbol: template.symbol,
            period: template.period,
            categorySlug: (template as any).categorySlug || null,
            advanceTime: template.advanceTime,
            oracleUrl: template.oracleUrl || null,
            seriesId: (template as any).seriesId || null,
            isActive: template.isActive,
            status: (template as any).status || 'ACTIVE',
            failureCount: (template as any).failureCount || 0,
          });

        } catch (createError: any) {
          // 🔥 异常处理：如果 Oracle 喂价失败，记录失败并检查熔断
          console.error(`❌ [RelayEngine] 模板 ${template.name} 创建市场失败:`, createError.message);
          // recordFailureAndCheckCircuitBreaker 是 engine.ts 中的内部函数，暂时跳过熔断检查
          const isPaused = false; // TODO: 实现熔断逻辑
          
          if (isPaused) {
            console.warn(`⏸️ [RelayEngine] 模板 ${template.name} 已熔断，跳过后续处理`);
          }
          // 继续处理下一个模板，不中断整个流程
        }
      } catch (error: any) {
        console.error(`❌ [RelayEngine] 处理模板 ${template.name} 失败:`, error.message);
        // 继续处理下一个模板，不中断整个流程
      }
    }

  } catch (error: any) {
    console.error('❌ [RelayEngine] 运行失败:', error.message);
    // 🔥 即使出错也要更新心跳（表示至少尝试运行了）
  } finally {
    // 🔥 修复：使用 finally 确保无论成功还是失败，都会更新心跳
    // 这样即使出现错误，也能记录最后一次运行尝试的时间
    try {
      const nowUtc = dayjs.utc().toISOString();
      await prisma.system_settings.upsert({
        where: { key: 'lastFactoryRunAt' },
        update: { value: nowUtc },
        create: { key: 'lastFactoryRunAt', value: nowUtc, updatedAt: new Date() },
      });

    } catch (heartbeatError: any) {
      // 心跳更新失败不影响主流程，只记录日志
      console.error(`⚠️ [Heartbeat] 更新心跳失败: ${heartbeatError.message}`);
    }
  }
}
