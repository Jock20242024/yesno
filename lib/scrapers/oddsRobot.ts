/**
 * 赔率同步机器人 - 分布式差分同步架构
 * 
 * 核心逻辑：
 * 1. 从 Polymarket API 抓取最新赔率数据
 * 2. 使用差分过滤，仅在价格变化 > 0.001 时才下发任务
 * 3. 使用 BullMQ 任务队列异步更新数据库
 * 
 * 功能：
 * 1. 定期同步 POLYMARKET 市场的赔率数据（outcomePrices, initialPrice）
 * 2. 只更新已上架（status: 'OPEN'）的市场
 * 3. 将执行数据持久化到 scraper_tasks 表
 */

import { prisma } from '@/lib/prisma';
import { filterMarketsByPriceChange, calculateDiffHitRate } from '@/lib/odds/diffSync';
import { addOddsUpdateJobs, getQueueBacklog, getQueueStats } from '@/lib/queue/oddsQueue';
import type { OddsUpdateJobData } from '@/lib/queue/oddsQueue';
import { tryBindExternalId } from '@/lib/factory/engine';

interface OddsSyncResult {
  success: boolean;
  itemsCount: number; // 检查的市场数量
  queuedCount: number; // 加入队列的数量
  filteredCount: number; // 被过滤掉的数量（无显著价格变化）
  diffHitRate: number; // 差分命中率（百分比）
  failedMarkets?: Array<{ marketId: string; marketTitle: string; externalId: string; reason: string }>; // 失败的市场列表
  error?: string;
  lastPulse?: Date;
}

/**
 * 日志记录器 - 用于存储详细的操作日志
 */
interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
}

// 全局日志存储（用于前端访问）
let recentLogs: LogEntry[] = [];
const MAX_LOG_ENTRIES = 100;

function addLog(level: 'info' | 'warn' | 'error', message: string) {
  const entry: LogEntry = {
    timestamp: new Date(),
    level,
    message,
  };
  recentLogs.push(entry);
  // 限制日志数量
  if (recentLogs.length > MAX_LOG_ENTRIES) {
    recentLogs = recentLogs.slice(-MAX_LOG_ENTRIES);
  }
  // 🔥 性能优化：仅在错误级别输出到控制台（避免高频日志刷屏）
  // 日志依然会存储到 recentLogs 供前端查看
  if (level === 'error') {
    const emoji = '❌';
    console.log(`${emoji} [OddsRobot] ${message}`);
  }
  // 在开发环境下，也输出 warn 级别的日志（但不输出 info）
  else if (level === 'warn' && process.env.NODE_ENV === 'development') {
    const emoji = '⚠️';
    console.log(`${emoji} [OddsRobot] ${message}`);
  }
}

/**
 * 获取最近的日志（供统计 API 使用）
 */
export function getRecentLogs(): LogEntry[] {
  return recentLogs.slice(-20); // 返回最近 20 条
}

/**
 * 解析 outcomePrices 并计算价格和概率
 */
function parseOutcomePrices(outcomePrices: string | string[]): {
  outcomePricesJson: string;
  initialPrice: number;
  yesProbability: number;
  noProbability: number;
} {
  // 保存 outcomePrices 原始数据（JSON 字符串格式）
  let outcomePricesJson: string;
  if (typeof outcomePrices === 'string') {
    outcomePricesJson = outcomePrices;
  } else if (Array.isArray(outcomePrices)) {
    outcomePricesJson = JSON.stringify(outcomePrices);
  } else {
    throw new Error('Invalid outcomePrices format');
  }

  // 解析 outcomePrices 计算 initialPrice 和概率
  let prices: number[] = [];
  let initialPrice = 0.5;
  let yesProbability = 50;
  let noProbability = 50;

  try {
    if (typeof outcomePrices === 'string') {
      const parsed = JSON.parse(outcomePrices);
      if (Array.isArray(parsed)) {
        prices = parsed.map((p: any) => {
          const num = parseFloat(String(p));
          return isNaN(num) ? 0 : num;
        }).filter((p: number) => p >= 0);
      }
    } else if (Array.isArray(outcomePrices)) {
      prices = outcomePrices.map((p: any) => {
        const num = typeof p === 'string' ? parseFloat(p) : (typeof p === 'number' ? p : 0);
        return isNaN(num) ? 0 : num;
      }).filter((p: number) => p >= 0);
    }

    if (prices.length >= 2 && prices[0] >= 0 && prices[1] >= 0) {
      const yesPrice = prices[0];
      const noPrice = prices[1];
      initialPrice = yesPrice;

      const total = yesPrice + noPrice;
      if (total > 0) {
        yesProbability = Math.round((yesPrice / total) * 100);
        noProbability = 100 - yesProbability;
      }
    }
  } catch (error) {
    console.warn(`⚠️ [OddsRobot] 解析 outcomePrices 失败:`, error);
  }

  return {
    outcomePricesJson,
    initialPrice,
    yesProbability,
    noProbability,
  };
}

/**
 * 赔率同步机器人主函数
 * 分布式差分同步架构：使用 Redis 缓存进行差分过滤，使用 BullMQ 队列异步更新
 */
export async function syncOdds(): Promise<OddsSyncResult> {
  const startTime = new Date();
  addLog('info', '========== 开始赔率同步（差分同步架构）==========');
  addLog('info', `开始时间: ${startTime.toISOString()}`);

  let checkedCount = 0; // 检查的市场数量

  try {
    // 🔥 定向扫描：仅查询已上架（status: 'OPEN'）的 POLYMARKET 市场
    // 注意：数据库中状态值为 'OPEN'（开放中），不是 'ACTIVE'
    addLog('info', '开始查询数据库中需要同步的活跃市场...');
    
    // 🔥 先检查数据库中的市场总数和符合条件的数量（用于调试）
    const totalMarkets = await prisma.market.count({ where: { isActive: true } });
    const polymarketMarkets = await prisma.market.count({ where: { source: 'POLYMARKET', isActive: true } });
    const openPolymarketMarkets = await prisma.market.count({ 
      where: { source: 'POLYMARKET', status: 'OPEN', isActive: true } 
    });
    
    addLog('info', `数据库统计: 总市场数=${totalMarkets}, POLYMARKET市场数=${polymarketMarkets}, 活跃上架市场数=${openPolymarketMarkets}`);
    
    // 🔥 红蓝双轨制：同时处理POLYMARKET来源和工厂生成的市场（isFactory=true）
    const activeMarkets = await prisma.market.findMany({
      where: {
        OR: [
          { source: 'POLYMARKET', status: 'OPEN', isActive: true },
          { isFactory: true, status: 'OPEN', isActive: true }, // 工厂生成的市场也需要同步赔率
        ],
      },
      select: {
        id: true,
        externalId: true,
        title: true,
        isFactory: true, // 需要判断是否为工厂生成的市场
        source: true,
        templateId: true, // 🔥 需要 templateId 来获取 symbol 和 period
        period: true, // 🔥 需要 period 来匹配 externalId
        closingDate: true, // 🔥 需要 closingDate 来匹配 externalId
        marketTemplate: {
          select: {
            symbol: true, // 🔥 需要 symbol 来匹配 externalId
          },
        },
      },
      take: 1000, // 限制每次处理的数量，确保 30 秒内完成
    });

    checkedCount = activeMarkets.length; // 记录检查的数量
    const polymarketCount = activeMarkets.filter(m => (m as any).source === 'POLYMARKET').length;
    const factoryCount = activeMarkets.filter(m => (m as any).isFactory === true).length;
    addLog('info', `找到 ${activeMarkets.length} 个活跃市场 (POLYMARKET: ${polymarketCount}, 工厂生成: ${factoryCount}, status: 'OPEN', isActive: true)`);
    
    // 🔥 如果找到的市场数量为 0，记录详细信息以便调试
    if (activeMarkets.length === 0) {
      addLog('warn', `⚠️ 查询结果为空！请检查数据库中是否有符合以下条件的市场：source='POLYMARKET', status='OPEN', isActive=true`);
      
      // 🔥 即使没有市场，也要更新数据库记录
      await prisma.scraperTask.upsert({
        where: { name: 'OddsRobot' },
        create: {
          name: 'OddsRobot',
          status: 'NORMAL',
          lastRunTime: startTime,
          frequency: 1,
          message: JSON.stringify({ checkedCount: 0, queuedCount: 0, filteredCount: 0, diffHitRate: 0 }),
        },
        update: {
          status: 'NORMAL',
          lastRunTime: startTime,
          message: JSON.stringify({ checkedCount: 0, queuedCount: 0, filteredCount: 0, diffHitRate: 0 }),
        },
      });
      
      return {
        success: true,
        itemsCount: 0,
        queuedCount: 0,
        filteredCount: 0,
        diffHitRate: 0,
        lastPulse: startTime,
      };
    }

    // 🔥 从 Polymarket API 获取最新赔率数据
    // 🔥 修复：对于工厂市场，未来场次可能还没在 Polymarket 开启（closed=true），所以需要查询所有市场
    // 先尝试查询开放市场（更快），如果找不到某个工厂市场的 externalId，再查询所有市场
    const openMarketsUrl = 'https://gamma-api.polymarket.com/markets?closed=false&limit=1000&offset=0&order=volume&ascending=false';
    const allMarketsUrl = 'https://gamma-api.polymarket.com/markets?limit=1000&offset=0&order=volume&ascending=false';
    
    addLog('info', `开始请求 Polymarket API: ${openMarketsUrl}`);
    
    let apiMarkets: any[] = [];
    try {
      // 首先查询开放市场（更快的响应）
      const response = await fetch(openMarketsUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
      }

      apiMarkets = await response.json();
      addLog('info', `从开放市场API获取 ${apiMarkets.length} 个市场数据`);
      
      // 🔥 检查是否有工厂市场的 externalId 在开放市场中找不到
      const factoryMarkets = activeMarkets.filter(m => (m as any).isFactory);
      const factoryExternalIds = new Set(
        factoryMarkets
          .map(m => m.externalId)
          .filter((id): id is string => !!id)
      );
      
      const foundExternalIds = new Set(apiMarkets.map((m: any) => m.id));
      const missingExternalIds = Array.from(factoryExternalIds).filter(id => !foundExternalIds.has(id));
      
      // 🔥 如果有工厂市场的 externalId 在开放市场中找不到，查询所有市场
      if (missingExternalIds.length > 0) {
        addLog('info', `发现 ${missingExternalIds.length} 个工厂市场的 externalId 在开放市场中未找到，查询所有市场...`);
        try {
          const allMarketsResponse = await fetch(allMarketsUrl, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });
          
          if (allMarketsResponse.ok) {
            const allMarkets = await allMarketsResponse.json();
            addLog('info', `从所有市场API获取 ${allMarkets.length} 个市场数据`);
            
            // 合并数据：优先使用开放市场的数据，补充所有市场的数据
            const allMarketsMap = new Map(allMarkets.map((m: any) => [m.id, m]));
            missingExternalIds.forEach(id => {
              if (allMarketsMap.has(id)) {
                apiMarkets.push(allMarketsMap.get(id));
                addLog('info', `✅ 从所有市场中找到缺失的工厂市场: ${id}`);
              }
            });
            
            addLog('info', `合并后共有 ${apiMarkets.length} 个市场数据`);
          }
        } catch (allMarketsError: any) {
          addLog('warn', `查询所有市场失败，但继续使用开放市场数据: ${allMarketsError.message}`);
        }
      }
    } catch (error: any) {
      addLog('error', `API 请求失败: ${error.message}`);
      throw error;
    }

    // 🔥 构建 externalId 到 API 数据的映射
    addLog('info', '开始构建市场数据映射...');
    const apiMarketMap = new Map<string, any>();
    apiMarkets.forEach((market: any) => {
      if (market.id) {
        apiMarketMap.set(market.id, market);
      }
    });
    addLog('info', `构建完成，共 ${apiMarketMap.size} 个市场映射`);

    // 🔥 并行抓取：使用 Promise.all 批量处理市场数据
    addLog('info', '开始并行提取市场赔率数据...');
    
    const marketExtractionResults = await Promise.all(
      activeMarkets.map(async (market) => {
        try {
          // 🔥 增强错误信息：包含市场标题和 externalId
          const marketInfo = {
            id: market.id,
            title: market.title || '未知标题',
            externalId: market.externalId || '未设置',
            isFactory: (market as any).isFactory || false,
            source: (market as any).source || 'UNKNOWN',
          };

          // 🔥 如果市场没有 externalId 且是工厂市场，尝试自动绑定
          let finalExternalId = market.externalId;
          if (!finalExternalId && (market as any).isFactory && market.templateId && market.marketTemplate?.symbol && market.period && market.closingDate) {
            // 🔥 添加15分钟市场的特殊日志
            const is15Min = market.period === 15;
            if (is15Min) {
              addLog('info', `🔍 [OddsRobot] ⏰ 15分钟市场 ${market.id} (${marketInfo.title}) 没有 externalId，尝试自动绑定...`);
              addLog('info', `🔍 [OddsRobot] ⏰ 15分钟市场详情: symbol=${market.marketTemplate.symbol}, period=${market.period}, closingDate=${new Date(market.closingDate).toISOString()}`);
            } else {
              addLog('info', `🔍 [OddsRobot] 市场 ${market.id} (${marketInfo.title}) 没有 externalId，尝试自动绑定...`);
            }
            try {
              // 🔥 传递市场状态和市场ID，确保强制刷新逻辑生效并立即同步赔率
              const matchedId = await tryBindExternalId(
                market.marketTemplate.symbol,
                market.period,
                new Date(market.closingDate),
                'OPEN', // 传递市场状态，触发强制刷新逻辑
                market.id // 🔥 传递市场ID，绑定成功后立即同步赔率
              );
              
              if (matchedId) {
                if (is15Min) {
                  addLog('info', `✅ [OddsRobot] ⏰ 15分钟市场 ${market.id} 成功匹配 externalId: ${matchedId}`);
                } else {
                  addLog('info', `✅ [OddsRobot] 成功为市场 ${market.id} 匹配 externalId: ${matchedId}`);
                }
                // 更新数据库中的 externalId
                await prisma.market.update({
                  where: { id: market.id },
                  data: { externalId: matchedId },
                });
                finalExternalId = matchedId;
                // 🔥 注意：赔率同步已在 tryBindExternalId 内部异步执行，这里不需要再次调用
              } else {
                if (is15Min) {
                  addLog('warn', `⚠️ [OddsRobot] ⏰ 15分钟市场 ${market.id} 无法匹配 externalId，可能 Polymarket 中不存在对应市场`);
                } else {
                  addLog('warn', `⚠️ [OddsRobot] 市场 ${market.id} 无法匹配 externalId，可能 Polymarket 中不存在对应市场`);
                }
                return { 
                  success: false, 
                  marketId: market.id, 
                  marketTitle: marketInfo.title,
                  externalId: '未设置',
                  reason: '❌ 错误：没有 externalId 且自动匹配失败（Polymarket 中不存在对应市场）' 
                };
              }
            } catch (bindError: any) {
              if (is15Min) {
                addLog('error', `❌ [OddsRobot] ⏰ 15分钟市场 ${market.id} 自动绑定 externalId 失败: ${bindError.message}`);
              } else {
                addLog('error', `❌ [OddsRobot] 市场 ${market.id} 自动绑定 externalId 失败: ${bindError.message}`);
              }
              return { 
                success: false, 
                marketId: market.id, 
                marketTitle: marketInfo.title,
                externalId: '未设置',
                reason: `❌ 错误：自动绑定 externalId 失败 - ${bindError.message}` 
              };
            }
          } else if (!finalExternalId) {
            // 如果不是工厂市场或缺少必要信息，直接报错
            return { 
              success: false, 
              marketId: market.id, 
              marketTitle: marketInfo.title,
              externalId: '未设置',
              reason: '❌ 错误：没有 externalId（非工厂市场或缺少匹配所需信息）' 
            };
          }

          let apiMarket = apiMarketMap.get(finalExternalId!);
          
          // 🔥 关键修复：如果绑定成功后 apiMarketMap 中没有数据，单独查询一次 API
          if (!apiMarket && finalExternalId && finalExternalId !== market.externalId) {
            // 这说明是刚刚绑定成功的 externalId，需要单独查询
            const is15Min = market.period === 15;
            if (is15Min) {
              addLog('info', `🔄 [OddsRobot] ⏰ 15分钟市场 ${market.id} 刚绑定成功，单独查询 API 获取赔率数据...`);
            } else {
              addLog('info', `🔄 [OddsRobot] 市场 ${market.id} 刚绑定成功，单独查询 API 获取赔率数据...`);
            }
            
            try {
              const singleMarketUrl = `https://gamma-api.polymarket.com/markets/${finalExternalId}`;
              const singleMarketResponse = await fetch(singleMarketUrl, {
                headers: {
                  'Accept': 'application/json',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
              });
              
              if (singleMarketResponse.ok) {
                apiMarket = await singleMarketResponse.json();
                if (is15Min) {
                  addLog('info', `✅ [OddsRobot] ⏰ 15分钟市场 ${market.id} 单独查询成功，获取到赔率数据`);
                } else {
                  addLog('info', `✅ [OddsRobot] 市场 ${market.id} 单独查询成功，获取到赔率数据`);
                }
              } else {
                const is15Min = market.period === 15;
                const logMsg = `❌ 错误：单独查询 externalId="${finalExternalId}" 失败（HTTP ${singleMarketResponse.status}）`;
                if (is15Min) {
                  addLog('warn', `⚠️ [OddsRobot] ⏰ 15分钟市场 ${market.id} ${logMsg}`);
                } else {
                  addLog('warn', `⚠️ [OddsRobot] 市场 ${market.id} ${logMsg}`);
                }
              }
            } catch (fetchError: any) {
              const is15Min = market.period === 15;
              const logMsg = `❌ 错误：单独查询 externalId="${finalExternalId}" 失败 - ${fetchError.message}`;
              if (is15Min) {
                addLog('warn', `⚠️ [OddsRobot] ⏰ 15分钟市场 ${market.id} ${logMsg}`);
              } else {
                addLog('warn', `⚠️ [OddsRobot] 市场 ${market.id} ${logMsg}`);
              }
            }
          }
          
          if (!apiMarket) {
            const is15Min = market.period === 15;
            const logMsg = `❌ 错误：API 中没有找到 externalId="${finalExternalId}" 对应的市场数据（可能是 ID 错误或市场已关闭）`;
            if (is15Min) {
              addLog('warn', `⚠️ [OddsRobot] ⏰ 15分钟市场 ${market.id} ${logMsg}`);
            } else {
              addLog('warn', `⚠️ [OddsRobot] 市场 ${market.id} ${logMsg}`);
            }
            return { 
              success: false, 
              marketId: market.id, 
              marketTitle: marketInfo.title,
              externalId: finalExternalId || '未设置',
              reason: logMsg
            };
          }
          
          // 🔥 15分钟市场的特殊日志：记录找到API数据
          const is15Min = market.period === 15;
          if (is15Min) {
            addLog('info', `✅ [OddsRobot] ⏰ 15分钟市场 ${market.id} 在API中找到数据，externalId=${finalExternalId}`);
          }

          // 提取 outcomePrices
          let outcomePrices: string | string[] | undefined = apiMarket.outcomePrices;
          
          // 情况1：在 events[0].markets[0].outcomePrices
          if (!outcomePrices && apiMarket.events && Array.isArray(apiMarket.events) && apiMarket.events.length > 0) {
            const firstEvent = apiMarket.events[0];
            if (firstEvent.markets && Array.isArray(firstEvent.markets) && firstEvent.markets.length > 0) {
              const firstSubMarket = firstEvent.markets[0];
              outcomePrices = firstSubMarket.outcomePrices;
            }
          }

          if (!outcomePrices) {
            return { 
              success: false, 
              marketId: market.id, 
              marketTitle: marketInfo.title,
              externalId: marketInfo.externalId,
              reason: `❌ 错误：API 返回的数据中没有 outcomePrices 字段（API 数据结构异常）` 
            };
          }

          // 🔥 红蓝双轨制：工厂生成的市场（isFactory=true），将Polymarket的Yes映射给UP，No映射给DOWN
          // 系统内部使用Yes/No枚举，工厂生成的市场遵循：UP = Yes，DOWN = No
          // Polymarket的Yes价格 -> 本地Yes（对应UP），No价格 -> 本地No（对应DOWN）
          // 因此直接使用Polymarket的outcomePrices即可，不需要特殊转换

          // 尝试转换为 JSON 字符串格式
          let outcomePricesJson: string;
          try {
            outcomePricesJson = typeof outcomePrices === 'string' 
              ? outcomePrices 
              : JSON.stringify(outcomePrices);
          } catch (jsonError: any) {
            return { 
              success: false, 
              marketId: market.id, 
              marketTitle: marketInfo.title,
              externalId: marketInfo.externalId,
              reason: `❌ 错误：JSON 解析失败 - ${jsonError.message}` 
            };
          }

          // 🔥 15分钟市场的特殊日志：记录成功提取赔率
          if (is15Min) {
            try {
              const prices = typeof outcomePricesJson === 'string' ? JSON.parse(outcomePricesJson) : outcomePricesJson;
              const yesPrice = Array.isArray(prices) && prices.length > 0 ? parseFloat(prices[0]) : null;
              addLog('info', `✅ [OddsRobot] ⏰ 15分钟市场 ${market.id} 成功提取赔率: YES=${yesPrice !== null ? (yesPrice * 100).toFixed(2) + '%' : 'N/A'}`);
            } catch (e) {
              // 忽略解析错误
            }
          }
          
          return {
            success: true,
            marketId: market.id,
            outcomePrices: outcomePricesJson,
          };
        } catch (error: any) {
          return { 
            success: false, 
            marketId: market.id, 
            marketTitle: market.title || '未知标题',
            externalId: market.externalId || '未设置',
            reason: `❌ 错误：提取失败 - ${error.message || String(error)}` 
          };
        }
      })
    );

    // 分离成功和失败的结果
    const marketsWithPrices: Array<{ id: string; outcomePrices: string | null }> = [];
    const skippedMarkets: Array<{ marketId: string; marketTitle: string; externalId: string; reason: string }> = [];

    marketExtractionResults.forEach((result) => {
      if (result.success && result.outcomePrices) {
        marketsWithPrices.push({
          id: result.marketId,
          outcomePrices: result.outcomePrices,
        });
      } else {
        skippedMarkets.push({ 
          marketId: result.marketId, 
          marketTitle: result.marketTitle || '未知标题',
          externalId: result.externalId || '未设置',
          reason: result.reason || '未知原因' 
        });
      }
    });

    const skippedCount = skippedMarkets.length;
    
    // 🔥 详细记录所有失败的市场信息（包含市场标题和详细错误原因）
    if (skippedCount > 0) {
      addLog('warn', `⚠️ 发现 ${skippedCount} 个市场提取失败，开始详细记录失败原因...`);
      skippedMarkets.forEach(({ marketId, marketTitle, externalId, reason }) => {
        addLog('warn', `  ❌ 【市场标题】${marketTitle}`);
        addLog('warn', `     【市场ID】${marketId} | 【External ID】${externalId}`);
        addLog('warn', `     【错误原因】${reason}`);
      });
      addLog('warn', `失败详情记录完成，共 ${skippedCount} 个市场未能提取赔率数据`);
    }

    addLog('info', `并行提取完成: 有效市场 ${marketsWithPrices.length} 个，失败 ${skippedCount} 个`);

    // 🔥 差分过滤：仅在价格变化 > 0.001 时才加入队列
    addLog('info', '开始差分过滤（价格变化阈值: 0.001）...');
    const marketsToUpdate = await filterMarketsByPriceChange(marketsWithPrices);
    const filteredCount = marketsWithPrices.length - marketsToUpdate.length;
    const diffHitRate = calculateDiffHitRate(marketsWithPrices.length, filteredCount);

    // 🔥 实时日志：符合用户要求的格式
    addLog('info', `[30s 轮询] 发现 ${checkedCount} 个活跃市场 -> ${marketsToUpdate.length} 个价格变动 -> 已下发同步队列`);
    addLog('info', `差分过滤完成: 需要更新 ${marketsToUpdate.length} 个，过滤 ${filteredCount} 个（命中率: ${diffHitRate}%）`);

    // 🔥 准备队列任务数据（需要查找市场标题）
    const queueJobs: OddsUpdateJobData[] = [];
    const queueJobFailures: Array<{ marketId: string; marketTitle: string; reason: string }> = [];
    
    // 🔥 创建市场ID到标题的映射，便于后续查找
    const marketIdToTitle = new Map<string, string>();
    activeMarkets.forEach(m => {
      marketIdToTitle.set(m.id, m.title || '未知标题');
    });
    
    for (const market of marketsToUpdate) {
      try {
        const parsed = parseOutcomePrices(market.outcomePrices!);
        
        // 🔥 红蓝双轨制：工厂生成的市场（isFactory=true），Polymarket的Yes对应UP（本地Yes），No对应DOWN（本地No）
        // parseOutcomePrices已经正确解析了Yes和No，直接使用即可，不许报错
        // Polymarket Yes价格 -> 本地Yes（UP），Polymarket No价格 -> 本地No（DOWN）
        
        queueJobs.push({
          marketId: market.id,
          outcomePrices: parsed.outcomePricesJson,
          initialPrice: parsed.initialPrice,
          yesProbability: parsed.yesProbability,
          noProbability: parsed.noProbability,
        });
      } catch (error: any) {
        const marketTitle = marketIdToTitle.get(market.id) || '未知标题';
        const reason = `解析 outcomePrices 失败: ${error.message}`;
        queueJobFailures.push({ marketId: market.id, marketTitle, reason });
        addLog('error', `准备队列任务失败 - 【市场标题】${marketTitle} | 【市场ID】${market.id}: ${reason}`);
      }
    }

    // 🔥 记录队列任务准备失败的情况（包含市场标题）
    if (queueJobFailures.length > 0) {
      addLog('error', `⚠️ 队列任务准备阶段失败 ${queueJobFailures.length} 个市场:`);
      queueJobFailures.forEach(({ marketId, marketTitle, reason }) => {
        addLog('error', `  ❌ 【市场标题】${marketTitle} | 【市场ID】${marketId}: ${reason}`);
      });
    }

    // 🔥 批量添加到队列
    if (queueJobs.length > 0) {
      addLog('info', `将 ${queueJobs.length} 个更新任务加入队列...`);
      await addOddsUpdateJobs(queueJobs);
      addLog('info', `队列任务添加完成`);
    } else {
      addLog('info', '没有需要更新的市场，跳过队列添加');
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // 🔥 详细统计：检查数量 vs 入队数量
    const totalProcessed = checkedCount; // 检查的市场总数
    const totalQueued = queueJobs.length; // 成功加入队列的数量
    const totalFailed = skippedCount + queueJobFailures.length; // 失败总数（提取失败 + 队列准备失败）
    const diff = totalProcessed - totalQueued - filteredCount; // 差异数量（应该是失败的数量）

    addLog('info', `同步完成统计: 检查 ${checkedCount} 个 -> 提取成功 ${marketsWithPrices.length} 个 -> 价格变化 ${marketsToUpdate.length} 个 -> 加入队列 ${queueJobs.length} 个`);
    addLog('info', `失败分析: 提取失败 ${skippedCount} 个，队列准备失败 ${queueJobFailures.length} 个，过滤 ${filteredCount} 个，耗时 ${duration}ms`);
    
    // 🔥 如果发现数量不匹配，详细记录
    if (diff !== 0 && diff !== totalFailed) {
      addLog('warn', `⚠️ 数量不匹配警告: 检查 ${checkedCount} 个，但只入队 ${queueJobs.length} 个，差异 ${diff} 个。请检查日志排查原因。`);
    }

    // 🔥 更新 scraper_tasks 表，记录执行结果
    // 注意：message 字段存储的是 JSON 数据，不是错误消息
    // 真正的错误应该存储在 error 字段中，或者通过 status='ABNORMAL' 标识
    const messageData: any = {
      checkedCount,
      queuedCount: queueJobs.length,
      filteredCount,
      diffHitRate,
      skippedCount,
      queueJobFailures: queueJobFailures.length, // 队列准备失败数量
      duration,
      // 🔥 保存失败的市场列表（包含标题和错误原因），供前端显示
      // 合并提取失败和队列准备失败的市场
      failedMarkets: [
        ...skippedMarkets.map(m => ({
          marketId: m.marketId,
          marketTitle: m.marketTitle,
          externalId: m.externalId,
          reason: m.reason,
        })),
        ...queueJobFailures.map(m => {
          const market = activeMarkets.find(am => am.id === m.marketId);
          return {
            marketId: m.marketId,
            marketTitle: m.marketTitle,
            externalId: market?.externalId || '未知',
            reason: m.reason,
          };
        }),
      ],
    };
    
    // 只在有错误时才添加 error 字段
    if (queueJobFailures.length > 0 || skippedCount > 0) {
      messageData.error = `提取失败 ${skippedCount} 个，队列准备失败 ${queueJobFailures.length} 个`;
    }
    
    await prisma.scraperTask.upsert({
      where: { name: 'OddsRobot' },
      create: {
        name: 'OddsRobot',
        status: 'NORMAL',
        lastRunTime: endTime,
        frequency: 1,
        message: JSON.stringify(messageData),
      },
      update: {
        status: 'NORMAL',
        lastRunTime: endTime,
        message: JSON.stringify(messageData),
      },
    });

    // 记录操作日志（使用系统用户或跳过）
    try {
      // 🔥 查找系统用户或第一个管理员用户
      const systemUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: 'yesno@yesno.com' },
            { isAdmin: true },
          ],
        },
        select: { id: true },
        take: 1,
      });

      if (systemUser?.id) {
        await prisma.adminLog.create({
          data: {
            adminId: systemUser.id,
            actionType: 'ODDS_ROBOT_SYNC',
            details: `赔率同步完成: 检查 ${checkedCount} 个，加入队列 ${queueJobs.length} 个，过滤 ${filteredCount} 个（命中率: ${diffHitRate}%），耗时 ${duration}ms`,
            timestamp: endTime,
          },
        });
      } else {
        console.warn('⚠️ [OddsRobot] 未找到系统用户，跳过日志记录');
      }
    } catch (logError: any) {
      // 日志记录失败不影响主流程
      console.error('❌ [OddsRobot] 日志记录失败:', logError);
    }

    addLog('info', '========== 赔率同步完成 ==========');

    return {
      success: true,
      itemsCount: checkedCount,
      queuedCount: queueJobs.length,
      filteredCount,
      diffHitRate,
      failedMarkets: skippedMarkets, // 🔥 返回失败的市场列表，供 API 使用
      lastPulse: endTime,
    };
  } catch (error: any) {
    addLog('error', `同步失败: ${error.message}`);
    addLog('error', `错误堆栈: ${error.stack}`);
    
    // 更新 scraper_tasks 表，记录错误
    const errorMessageData = {
      checkedCount,
      queuedCount: 0,
      filteredCount: 0,
      diffHitRate: 0,
      error: error instanceof Error ? error.message : String(error),
    };
    
    await prisma.scraperTask.upsert({
      where: { name: 'OddsRobot' },
      create: {
        name: 'OddsRobot',
        status: 'ABNORMAL',
        lastRunTime: new Date(),
        frequency: 1,
        message: JSON.stringify(errorMessageData),
      },
      update: {
        status: 'ABNORMAL',
        lastRunTime: new Date(),
        message: JSON.stringify(errorMessageData),
      },
    });

    return {
      success: false,
      itemsCount: checkedCount,
      queuedCount: 0,
      filteredCount: 0,
      diffHitRate: 0,
      failedMarkets: [], // 异常情况下返回空数组
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 启动赔率同步机器人（定时任务）
 * 每 30 秒执行一次同步
 */
export async function startOddsRobot() {
  console.log('🤖 [OddsRobot] 启动赔率同步机器人...');
  addLog('info', '========== 赔率机器人正式启动，正在扫描活跃池... ==========');
  
  // 启动队列工作器
  const { startOddsWorker } = await import('@/lib/queue/oddsQueue');
  startOddsWorker();
  
  // 立即执行一次
  await syncOdds();
  
  // 设置定时任务：每 30 秒执行一次
  setInterval(async () => {
    addLog('info', '定时任务触发：开始新一轮赔率同步...');
    await syncOdds();
  }, 30 * 1000); // 30 秒
  
  console.log('✅ [OddsRobot] 赔率同步机器人已启动，每 30 秒执行一次');
  addLog('info', '赔率同步机器人定时任务已启动，每 30 秒执行一次');
}

/**
 * 停止赔率同步机器人
 */
export async function stopOddsRobot() {
  const { stopOddsWorker } = await import('@/lib/queue/oddsQueue');
  await stopOddsWorker();
  console.log('🔒 [OddsRobot] 赔率同步机器人已停止');
}
