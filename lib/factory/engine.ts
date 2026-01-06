/**
 * 市场工厂引擎
 * 
 * 核心功能：
 * 1. 自动化创建市场
 * 2. 尝试绑定 externalId（从 Polymarket 查找）
 * 3. 熔断逻辑：连续失败3次自动暂停
 */

import { prisma } from '@/lib/prisma';
import dayjs from '@/lib/dayjs';
import { randomUUID } from 'crypto';

interface MarketTemplate {
  id: string;
  name: string;
  titleTemplate?: string | null; // 🔥 模板标题（支持占位符）
  symbol: string;
  period: number;
  categorySlug?: string | null; // 🔥 关联分类
  advanceTime: number;
  oracleUrl?: string | null;
  seriesId?: string | null; // 🔥 Polymarket Series ID
  isActive: boolean;
  status?: string; // ACTIVE | PAUSED
  failureCount?: number;
  pauseReason?: string | null;
  lastMarketId?: string | null;
  lastCreatedAt?: Date | null;
}

const FAILURE_THRESHOLD = 3; // 连续失败3次触发熔断

// 🔥 Global 单例强缓存：使用 globalThis 挂载，避免热重载清空
// 确保即使 Next.js 开发模式热重载，缓存依然存在
const globalCache = globalThis as unknown as {
  _marketCache: any[];
  _lastFetchTime: number;
  _isFetching: boolean;
};

// 初始化全局缓存变量（如果不存在）
if (!globalCache._marketCache) {
  globalCache._marketCache = [];
}
if (globalCache._lastFetchTime === undefined) {
  globalCache._lastFetchTime = 0;
}
if (globalCache._isFetching === undefined) {
  globalCache._isFetching = false;
}

const CACHE_TTL = 5 * 60 * 1000; // 🔥 缓存有效期：5分钟（3500个数据不需要每分钟都抓）

/**
 * 🔥 全量抓取 Polymarket 市场数据（支持强制刷新）
 * 
 * @param force 如果为 true，忽略缓存 TTL，强制执行网络请求
 * @returns 市场数据数组
 */
async function fetchMarkets(force: boolean = false): Promise<any[]> {
  const currentTime = Date.now();
  const timeSinceLastFetch = currentTime - globalCache._lastFetchTime;
  let allMarkets: any[] = [];
  
  // 🔥 强制刷新：忽略缓存 TTL 和 lastFetchTime，强制执行网络请求
  if (force) {
    // 🔥 性能优化：仅在需要时输出日志
    // console.log(`🔄 [GlobalCache] 🚀 强制刷新模式：忽略缓存 TTL，强制执行网络请求...`);
    
    // 🔥 如果正在抓取中，等待一小段时间后重试（最多等待 3 秒）
    if (globalCache._isFetching) {
      // 🔥 性能优化：删除等待日志
      // console.log(`⏳ [GlobalCache] 检测到正在抓取中，等待完成（强制刷新模式）...`);
      let waitCount = 0;
      const maxWait = 30; // 最多等待 3 秒（30 * 100ms）
      while (globalCache._isFetching && waitCount < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
      
      // 如果等待后仍在抓取，说明可能卡住了，强制继续
      if (globalCache._isFetching) {
        console.warn(`⚠️ [GlobalCache] 等待超时，强制继续刷新（可能并发请求卡住）`);
        globalCache._isFetching = false; // 强制释放锁
      }
    }
  }
  // 🔥 读取缓存：如果 5 分钟内抓取过且未强制刷新，直接返回内存中的缓存
  else if (timeSinceLastFetch < CACHE_TTL && globalCache._marketCache.length > 0) {
    // 🔥 性能优化：删除高频缓存命中日志
    // console.log(`⚡️ [GlobalCache] 命中缓存: ${globalCache._marketCache.length} 个市场，缓存年龄: ${Math.round(timeSinceLastFetch / 1000)}秒，跳过网络请求`);
    // 直接使用缓存数据，跳过所有网络请求
    allMarkets = [...globalCache._marketCache]; // 创建副本
    return allMarkets;
  }
  // 🔥 故障熔断：如果正在抓取中，直接返回旧缓存（即使为空也比卡死好）
  else if (globalCache._isFetching) {
    // 🔥 性能优化：删除高频日志
    // console.log(`🔒 [GlobalCache] 检测到正在抓取中，返回旧缓存避免并发请求 (${globalCache._marketCache.length} 个)`);
    allMarkets = [...globalCache._marketCache]; // 返回旧缓存，即使为空
    return allMarkets;
  }
  
  // 🔥 缓存过期或强制刷新，启动新的抓取任务
  // 设置抓取锁，防止并发请求
  globalCache._isFetching = true;
  // 🔥 性能优化：仅在强制刷新时输出日志
  if (force) {

  }
  
  try {
    // 🔥 性能优化：仅在强制刷新时输出日志
    // console.log(`🚀 [FactoryEngine] ${force ? '强制刷新模式：' : ''}开始全量抓取开放市场（漏斗模式）...`);
    
    // 🔥 漏斗模式 (Funnel Strategy)：全量循环抓取所有市场
    // 目标：确保抓取所有 active=true / closed=false 的市场，避免因分页截断导致匹配失败
    const limit = 1000; // 单页最大数量（API 可能强制返回 500，但我们要继续抓取）
    const MAX_SAFE_LIMIT = 6000; // 安全上限（防止无限循环）
    let offset = 0;
    let page = 1;
    let hasMoreData = true;

    /**
     * 带重试的 fetch 函数
     * 🔥 增强错误处理和超时控制
     */
    const fetchWithRetry = async (url: string, retries = 3): Promise<Response> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          // 🔥 添加超时控制（30秒），防止请求无限挂起
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          try {
            const response = await fetch(url, {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              return response;
            }
            
            // 如果是最后一次尝试，返回响应（即使失败）
            if (attempt === retries) {
              return response;
            }
            
            // 🔥 性能优化：仅在开发环境或错误严重时输出日志
            if (response.status >= 500) {
              console.warn(`⚠️ [FactoryEngine] 服务器错误（尝试 ${attempt}/${retries}），HTTP ${response.status}，将在 ${attempt * 500}ms 后重试...`);
            }
            await new Promise(resolve => setTimeout(resolve, attempt * 500));
            
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            throw fetchError;
          }
          
        } catch (error: any) {
          // 🔥 增强错误分类处理
          const isTimeout = error.name === 'AbortError' || error.message?.includes('timeout');
          const isNetworkError = error.message?.includes('fetch failed') || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND';
          
          // 如果是最后一次尝试，抛出错误
          if (attempt === retries) {
            if (isTimeout) {
              throw new Error(`请求超时（${url}）`);
            } else if (isNetworkError) {
              throw new Error(`网络连接失败（${error.message}）`);
            }
            throw error;
          }
          
          // 🔥 性能优化：仅在网络错误或超时时输出警告（避免刷屏）
          if (isTimeout || isNetworkError) {
            console.warn(`⚠️ [FactoryEngine] 网络错误（尝试 ${attempt}/${retries}）: ${isTimeout ? '请求超时' : error.message}，将在 ${attempt * 500}ms 后重试...`);
          }
          await new Promise(resolve => setTimeout(resolve, attempt * 500));
        }
      }
      
      throw new Error('所有重试都失败了');
    };
    
    // 策略1：全量循环抓取开放市场（closed=false）
    while (hasMoreData && allMarkets.length < MAX_SAFE_LIMIT) {
      const apiUrl = `https://gamma-api.polymarket.com/markets?closed=false&limit=${limit}&offset=${offset}&order=volume&ascending=false`;
      
      try {
        // 🔥 性能优化：删除高频循环内的调试日志（仅在开发环境或错误时输出）
        // console.log(`📥 [FactoryEngine] 正在抓取第 ${page} 页，offset=${offset}，当前累计获取 ${allMarkets.length} 个市场...`);
        
        const response = await fetchWithRetry(apiUrl);

        if (!response.ok) {
          console.warn(`⚠️ [FactoryEngine] Polymarket API 请求失败（页 ${page}）: HTTP ${response.status}，停止抓取`);
          hasMoreData = false;
          break;
        }

        const pageMarkets = await response.json();
        
        // 检查返回数据是否有效
        if (!pageMarkets || !Array.isArray(pageMarkets)) {
          console.warn(`⚠️ [FactoryEngine] API 返回无效数据格式（页 ${page}），停止抓取`);
          hasMoreData = false;
          break;
        }
        
        // 🔥 修复：只有返回空数组时才停止，不要判断 data.length < limit
        // 因为 API 可能强制返回 500 条（即使请求 limit=1000），但这不代表是最后一页
        if (pageMarkets.length === 0) {
          hasMoreData = false;
          break;
        }
        
        // 合并数据
        allMarkets.push(...pageMarkets);
        // 🔥 性能优化：删除高频循环内的调试日志
        // console.log(`✅ [FactoryEngine] 第 ${page} 页获取到 ${pageMarkets.length} 个市场，累计 ${allMarkets.length} 个市场`);
        
        // 准备下一页
        offset += pageMarkets.length; // 🔥 使用实际返回的数量作为 offset 增量（更准确）
        page++;
        
        // 🔥 性能优化：增加休眠到 500ms，给 CPU 喘息的机会，防止服务器卡顿
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error: any) {
        console.error(`❌ [FactoryEngine] 查询开放市场失败（页 ${page}）: ${error.message}，停止抓取`);
        hasMoreData = false;
        // 注意：这里不释放锁，让外层的 finally 块处理
        break;
      }
    }
    
    // 检查是否达到安全上限
    if (allMarkets.length >= MAX_SAFE_LIMIT) {
      console.warn(`⚠️ [FactoryEngine] 已达到安全上限 ${MAX_SAFE_LIMIT} 个市场，停止抓取`);
    }
    
    // 🔥 性能优化：删除非关键日志（仅在强制刷新时输出）
    // console.log(`🎯 [FactoryEngine] 开放市场抓取完成：共获取 ${allMarkets.length} 个市场`);
    
    // 策略2：如果开放市场中没找到匹配，再查询所有市场（包括已关闭的）
    // 注意：这里也使用全量循环，但只查询前几页（因为已关闭的市场通常很多）
    if (allMarkets.length === 0) {
      // 🔥 性能优化：删除非关键日志
      // console.log(`🔍 [FactoryEngine] 开放市场为空，尝试查询所有市场（包括已关闭的）...`);
      offset = 0;
      page = 1;
      hasMoreData = true;
      const MAX_CLOSED_PAGES = 3; // 已关闭市场最多查询3页（避免过多）
      
      while (hasMoreData && page <= MAX_CLOSED_PAGES && allMarkets.length < MAX_SAFE_LIMIT) {
        const allMarketsUrl = `https://gamma-api.polymarket.com/markets?limit=${limit}&offset=${offset}&order=volume&ascending=false`;
        
        try {
          // 🔥 性能优化：删除高频循环内的调试日志
          // console.log(`📥 [FactoryEngine] 正在抓取所有市场第 ${page} 页，offset=${offset}，当前累计获取 ${allMarkets.length} 个市场...`);
          
          const response = await fetchWithRetry(allMarketsUrl);

          if (!response.ok) {
            console.warn(`⚠️ [FactoryEngine] 查询所有市场失败（页 ${page}）: HTTP ${response.status}`);
            break;
          }

          const pageMarkets = await response.json();
          
          if (!pageMarkets || !Array.isArray(pageMarkets)) {
            console.warn(`⚠️ [FactoryEngine] API 返回无效数据格式（页 ${page}）`);
            break;
          }
          
          // 🔥 修复：只有返回空数组时才停止
          if (pageMarkets.length === 0) {
            break;
          }
          
          // 合并数据，去重（基于market.id）
          const existingIds = new Set(allMarkets.map(m => m.id));
          const newMarkets = pageMarkets.filter((m: any) => m.id && !existingIds.has(m.id));
          allMarkets.push(...newMarkets);
          // 🔥 性能优化：删除高频循环内的调试日志
          // console.log(`✅ [FactoryEngine] 所有市场第 ${page} 页获取到 ${newMarkets.length} 个新市场（累计 ${allMarkets.length} 个）`);
          
          // 🔥 修复：只要 data.length > 0 就继续，不要判断是否 < limit
          offset += pageMarkets.length; // 使用实际返回的数量
          page++;
          // 🔥 性能优化：增加休眠到 500ms，给 CPU 喘息的机会
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error: any) {
          console.warn(`⚠️ [FactoryEngine] 查询所有市场失败（页 ${page}）: ${error.message}`);
          break;
        }
      }
      
      // 🔥 性能优化：删除非关键日志
      // console.log(`🎯 [FactoryEngine] 所有市场抓取完成：共获取 ${allMarkets.length} 个市场`);
    }
    
    // 🔥 写入缓存：只有当 API 抓取完整结束后，才更新全局缓存并释放锁
    if (allMarkets.length > 0) {
      globalCache._marketCache = [...allMarkets]; // 创建副本，避免引用问题
      globalCache._lastFetchTime = Date.now();
      // 🔥 性能优化：仅在强制刷新时输出日志
      if (force) {

      }
    } else {
      // 🔥 性能优化：仅在强制刷新且失败时输出警告
      if (force) {
        console.warn(`⚠️ [GlobalCache] 抓取完成但未获取到市场数据 (强制刷新)`);
      }
    }
    
    // 释放抓取锁
    globalCache._isFetching = false;
    
    return allMarkets;
    
  } catch (error: any) {
    // 🔥 故障处理：即使抓取失败，也要释放锁，避免死锁
    console.error(`❌ [GlobalCache] 抓取过程中发生错误: ${error.message}`);
    globalCache._isFetching = false;
    
    // 如果有旧缓存，返回旧缓存；否则返回空数组
    if (globalCache._marketCache.length > 0) {
      // 🔥 性能优化：删除降级方案日志
      // console.log(`⚠️ [GlobalCache] 返回旧缓存作为降级方案 (${globalCache._marketCache.length} 个)`);
      return [...globalCache._marketCache];
    } else {
      console.warn(`⚠️ [GlobalCache] 无可用缓存，返回空结果`);
      return [];
    }
  } finally {
    // 🔥 确保锁被释放（双重保险）
    if (globalCache._isFetching) {
      globalCache._isFetching = false;
      // 🔥 性能优化：删除 finally 块日志
      // console.log(`🔓 [GlobalCache] finally 块释放抓取锁（双重保险）`);
    }
  }
}

/**
 * 计算当前周期的结束时间（严格对齐周期边界）
 * 🔥 全周期时间窗口自动对齐：15m/1h/4h/1d 精确对齐
 * 
 * 15分钟周期 (15m)：对齐到下一个 00/15/30/45 分钟刻度
 * 1小时周期 (1h)：对齐到下一个整点（如 22:00, 23:00）
 * 4小时周期 (4h)：对齐到每日的 00/04/08/12/16/20 点
 * 1天周期 (1d)：对齐到次日 00:00
 * 
 * @param periodMinutes 周期（分钟数）
 * @param fromTime 起始时间（可选，用于预生成，如果提供则基于此时间计算下一个周期）
 */
export function getNextPeriodTime(periodMinutes: number, fromTime?: Date): Date {
  const baseTime = fromTime || new Date();
  const nextTime = new Date(baseTime);
  
  // 重置秒和毫秒，确保对齐到秒级别（使用UTC）
  nextTime.setUTCSeconds(0);
  nextTime.setUTCMilliseconds(0);
  
  if (periodMinutes === 15) {
    // 🔥 15分钟周期：对齐到下一个 00/15/30/45 分钟刻度
    const minutes = baseTime.getUTCMinutes();
    const remainder = minutes % 15;
    const nextMinutes = remainder === 0 ? minutes + 15 : minutes - remainder + 15;
    nextTime.setUTCMinutes(nextMinutes);
    nextTime.setUTCSeconds(0);
    nextTime.setUTCMilliseconds(0);
    if (nextMinutes >= 60) {
      nextTime.setUTCHours(nextTime.getUTCHours() + 1);
      nextTime.setUTCMinutes(nextMinutes - 60);
    }
  } else if (periodMinutes === 60) {
    // 🔥 1小时周期：对齐到下一个整点（如 22:00, 23:00）
    nextTime.setUTCMinutes(0);
    nextTime.setUTCSeconds(0);
    nextTime.setUTCMilliseconds(0);
    // 如果当前时间已经是整点，则跳到下一个整点
    if (!fromTime && nextTime.getTime() <= baseTime.getTime()) {
      nextTime.setUTCHours(nextTime.getUTCHours() + 1);
    } else if (fromTime) {
      // 如果提供了起始时间，直接加1小时
      nextTime.setUTCHours(nextTime.getUTCHours() + 1);
    }
  } else if (periodMinutes === 240) {
    // 🔥 4小时周期：对齐到每日的 00/04/08/12/16/20 点
    const hours = baseTime.getUTCHours();
    const remainder = hours % 4;
    const nextHours = remainder === 0 ? hours + 4 : hours - remainder + 4;
    nextTime.setUTCMinutes(0);
    nextTime.setUTCSeconds(0);
    nextTime.setUTCMilliseconds(0);
    if (nextHours >= 24) {
      nextTime.setUTCDate(nextTime.getUTCDate() + 1);
      nextTime.setUTCHours(nextHours - 24);
    } else {
      nextTime.setUTCHours(nextHours);
    }
  } else if (periodMinutes === 1440) {
    // 🔥 1天周期：对齐到次日 00:00 (UTC)
    nextTime.setUTCDate(nextTime.getUTCDate() + 1);
    nextTime.setUTCHours(0);
    nextTime.setUTCMinutes(0);
    nextTime.setUTCSeconds(0);
    nextTime.setUTCMilliseconds(0);
  } else if (periodMinutes === 10080) {
    // 1周周期：对齐到下周一00:00 (UTC)
    const dayOfWeek = baseTime.getUTCDay(); // 0=周日, 1=周一, ..., 6=周六
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
    nextTime.setUTCDate(nextTime.getUTCDate() + daysUntilMonday);
    nextTime.setUTCHours(0);
    nextTime.setUTCMinutes(0);
    nextTime.setUTCSeconds(0);
    nextTime.setUTCMilliseconds(0);
  } else if (periodMinutes === 43200) {
    // 1月周期：对齐到下个月1号00:00 (UTC)
    nextTime.setUTCMonth(nextTime.getUTCMonth() + 1);
    nextTime.setUTCDate(1);
    nextTime.setUTCHours(0);
    nextTime.setUTCMinutes(0);
    nextTime.setUTCSeconds(0);
    nextTime.setUTCMilliseconds(0);
  } else {
    // 其他周期：通用计算（基于分钟数）
    const totalMinutes = baseTime.getUTCHours() * 60 + baseTime.getUTCMinutes();
    const remainder = totalMinutes % periodMinutes;
    const nextTotalMinutes = remainder === 0 
      ? totalMinutes + periodMinutes 
      : totalMinutes - remainder + periodMinutes;
    
    const nextHours = Math.floor(nextTotalMinutes / 60);
    const nextMins = nextTotalMinutes % 60;
    
    if (nextHours >= 24) {
      nextTime.setUTCDate(nextTime.getUTCDate() + Math.floor(nextHours / 24));
      nextTime.setUTCHours(nextHours % 24);
    } else {
      nextTime.setUTCHours(nextHours);
    }
    nextTime.setUTCMinutes(nextMins);
    nextTime.setUTCSeconds(0);
    nextTime.setUTCMilliseconds(0);
  }
  
  // 最后检查：如果未提供起始时间，确保返回的时间在未来（至少比当前时间多1秒）
  if (!fromTime) {
    const now = new Date();
    if (nextTime.getTime() <= now.getTime()) {
      // 如果计算出的时间还在过去或等于现在，加上一个周期
      nextTime.setTime(nextTime.getTime() + periodMinutes * 60 * 1000);
    }
  }
  
  return nextTime;
}

/**
 * 🔥 计算开始时间：StartTime = EndTime - 周期时间
 */
export function getStartTime(endTime: Date, periodMinutes: number): Date {
  const startTime = new Date(endTime);
  startTime.setTime(startTime.getTime() - periodMinutes * 60 * 1000);
  return startTime;
}

/**
 * 获取起始价格（startingPrice/起跑线）
 * 双重取价兜底：优先从Polymarket获取line值，失败则从Oracle获取实时市价
 * 绝对不许报错：只要能拿到实时市价，就必须成功返回
 */
async function getStartingPrice(template: MarketTemplate): Promise<number> {
  let seriesId: string | null = null;
  
  try {
    // 1. 优先尝试从Polymarket获取line值
    seriesId = (template as any).seriesId || null;
    
    if (!seriesId && template.oracleUrl) {
      const urlMatch = template.oracleUrl.match(/series[\/\s]+(\d+)/i);
      if (urlMatch) {
        seriesId = urlMatch[1];
      }
    }

    if (seriesId) {

      try {
        // 2. 直接请求对应的series API
        const seriesUrl = `https://gamma-api.polymarket.com/series/${seriesId}`;
        const response = await fetch(seriesUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (response.ok) {
          const seriesData = await response.json();
          const events = seriesData.events || [];

          if (events.length > 0) {
            // 3. 获取最新活跃市场
            const activeEvents = events.filter((e: any) => e.active !== false && e.closed !== true);
            const closedEvents = events.filter((e: any) => e.closed === true);
            const targetEvent = activeEvents.length > 0 ? activeEvents[0] : (closedEvents.length > 0 ? closedEvents[0] : events[0]);

            if (targetEvent?.id) {
              // 4. 从market详情API中提取line字段
              try {
                const marketUrl = `https://gamma-api.polymarket.com/markets/${targetEvent.id}`;
                const marketResponse = await fetch(marketUrl, {
                  headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  },
                });

                if (marketResponse.ok) {
                  const marketData = await marketResponse.json();
                  
                  // 提取line值
                  if (marketData.line !== undefined && marketData.line !== null) {
                    const lineValue = typeof marketData.line === 'string' 
                      ? parseFloat(marketData.line.replace(/,/g, ''))
                      : typeof marketData.line === 'number'
                      ? marketData.line
                      : null;
                    
                    if (lineValue !== null && !isNaN(lineValue) && lineValue > 0) {

                      return lineValue; // 成功获取，直接返回
                    }
                  }
                }
              } catch (error: any) {
                console.warn(`⚠️ [FactoryEngine] 获取市场详情失败: ${error.message}`);
              }
            }
          }
        }
      } catch (error: any) {
        console.warn(`⚠️ [FactoryEngine] Polymarket API请求失败: ${error.message}`);
      }
    } else {

    }
    
    // 5. 强制兜底：如果Polymarket未提供有效数据，使用Oracle实时市价

    return await getPriceFromOracle(template.symbol);
    
  } catch (error: any) {
    // 即使所有尝试都失败，也尝试从Oracle获取（最后的保障）
    console.warn(`⚠️ [FactoryEngine] 获取起始价格过程出错: ${error.message}，尝试Oracle兜底...`);
    return await getPriceFromOracle(template.symbol);
  }
}

/**
 * 从Oracle获取实时市价（强制兜底）
 */
async function getPriceFromOracle(symbol: string): Promise<number> {
  try {
    const { getPrice } = await import('@/lib/oracle');
    const priceResult = await getPrice(symbol);
    
    // getPrice返回OraclePriceResult对象，需要提取price属性
    const price = priceResult.price;
    
    if (price && price > 0) {

      return price;
    } else {
      throw new Error(`Oracle返回无效价格: ${price}`);
    }
  } catch (error: any) {
    console.error(`❌ [FactoryEngine] Oracle获取价格失败: ${error.message}`);
    // 如果Oracle也失败，抛出错误（但这种情况应该很少见）
    throw new Error(`无法获取 ${symbol} 的实时市价（Polymarket和Oracle均失败）`);
  }
}

/**
 * 🔥 强力资产别名映射字典（完整版）
 * 覆盖所有常见资产的别名和全称，确保模糊匹配的准确性
 * 从诊断脚本移植，确保匹配逻辑一致
 */
const ASSET_ALIASES: Record<string, string[]> = {
  'BTC': ['BITCOIN', 'BTC', 'XBT', 'BIT COIN'],
  'ETH': ['ETHEREUM', 'ETH', 'ETHER'],
  'SOL': ['SOLANA', 'SOL'],
  'BNB': ['BINANCE', 'BINANCE COIN', 'BNB'],
  'XRP': ['RIPPLE', 'XRP'],
  'ADA': ['CARDANO', 'ADA'],
  'DOGE': ['DOGECOIN', 'DOGE', 'DOG E'],
  'MATIC': ['POLYGON', 'MATIC'],
  'DOT': ['POLKADOT', 'DOT'],
  'AVAX': ['AVALANCHE', 'AVAX'],
  'LINK': ['CHAINLINK', 'LINK'],
  'UNI': ['UNISWAP', 'UNI'],
  'ATOM': ['COSMOS', 'ATOM'],
  'ETC': ['ETHEREUM CLASSIC', 'ETC', 'ETH CLASSIC'],
  'LTC': ['LITECOIN', 'LTC'],
  'BCH': ['BITCOIN CASH', 'BCH', 'BTC CASH'],
  'XLM': ['STELLAR', 'XLM'],
  'ALGO': ['ALGORAND', 'ALGO'],
  'VET': ['VECHAIN', 'VET'],
  'FIL': ['FILECOIN', 'FIL'],
  'TRX': ['TRON', 'TRX'],
  'EOS': ['EOS'],
  'AAVE': ['AAVE'],
  'MKR': ['MAKER', 'MKR'],
  'COMP': ['COMPOUND', 'COMP'],
  'YFI': ['YEARN FINANCE', 'YFI'],
  'SUSHI': ['SUSHISWAP', 'SUSHI'],
  'SNX': ['SYNTHETIX', 'SNX'],
  'NEAR': ['NEAR PROTOCOL', 'NEAR'],
  'APT': ['APTOS', 'APT'],
  'OP': ['OPTIMISM', 'OP'],
  'ARB': ['ARBITRUM', 'ARB'],
  'IMX': ['IMMUTABLE X', 'IMX'],
  'GRT': ['THE GRAPH', 'GRT'],
  'RUNE': ['THORCHAIN', 'RUNE'],
  'INJ': ['INJECTIVE', 'INJ'],
  'TIA': ['CELESTIA', 'TIA'],
  'SEI': ['SEI', 'SEI NETWORK'],
  'SUI': ['SUI'],
  'PYTH': ['PYTH NETWORK', 'PYTH'],
  'JTO': ['JITO', 'JTO'],
};

/**
 * 🔥 资产名称匹配评分
 * 使用别名字典进行模糊匹配，返回匹配分数
 * @returns 如果匹配，返回 100 分；否则返回 0 分
 */
function calculateSymbolMatchScore(localSymbol: string, polyMarket: any): number {
  const s = localSymbol.toUpperCase().trim();
  
  // 组合所有可能的文本字段
  const question = (polyMarket.question || '').toUpperCase();
  const slug = (polyMarket.slug || '').toUpperCase();
  const asset = (polyMarket.asset || '').toUpperCase();
  const description = (polyMarket.description || '').toUpperCase();
  const text = `${question} ${slug} ${asset} ${description}`;
  
  // 获取该资产的所有别名
  const aliases = ASSET_ALIASES[s] || [s];
  
  // 检查是否包含任何别名
  for (const alias of aliases) {
    if (text.includes(alias)) {
      return 100; // 名字命中别名 +100分
    }
  }
  
  return 0; // 不匹配
}

/**
 * 🔥 提取 Polymarket 市场的结束时间
 */
function extractEndTime(polyMarket: any): Date | null {
  if (polyMarket.endDate) {
    return new Date(polyMarket.endDate);
  }
  if (polyMarket.endDateISO) {
    return new Date(polyMarket.endDateISO);
  }
  if (polyMarket.events && Array.isArray(polyMarket.events) && polyMarket.events.length > 0) {
    const firstEvent = polyMarket.events[0];
    if (firstEvent.endDate) {
      return new Date(firstEvent.endDate);
    }
    if (firstEvent.endDateISO) {
      return new Date(firstEvent.endDateISO);
    }
  }
  return null;
}

/**
 * 🔥 实时同步赔率：绑定成功后立即同步
 * 从 Polymarket API 获取赔率并更新数据库，不要等下一轮 Cron
 */
async function syncMarketOddsImmediately(marketId: string, externalId: string): Promise<void> {
  try {
    // 单独查询 Polymarket API 获取市场数据
    const singleMarketUrl = `https://gamma-api.polymarket.com/markets/${externalId}`;
    const response = await fetch(singleMarketUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.warn(`⚠️ [FactoryEngine] 实时同步赔率失败: HTTP ${response.status} (marketId: ${marketId}, externalId: ${externalId})`);
      return;
    }

    const apiMarket = await response.json();

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
      console.warn(`⚠️ [FactoryEngine] 实时同步赔率：API 返回的数据中没有 outcomePrices 字段 (marketId: ${marketId})`);
      return;
    }

    // 转换为 JSON 字符串格式
    let outcomePricesJson: string;
    try {
      outcomePricesJson = typeof outcomePrices === 'string' 
        ? outcomePrices 
        : JSON.stringify(outcomePrices);
    } catch (jsonError: any) {
      console.warn(`⚠️ [FactoryEngine] 实时同步赔率：JSON 解析失败 - ${jsonError.message} (marketId: ${marketId})`);
      return;
    }

    // 🚀 解析 outcomePrices 获取 YES 概率（用于重置 AMM Pool）
    let yesProbability: number | null = null;
    try {
      const parsed = typeof outcomePrices === 'string' ? JSON.parse(outcomePrices) : outcomePrices;
      
      // 支持数组格式：[0.75, 0.25]（第一个是 YES 价格）
      if (Array.isArray(parsed) && parsed.length > 0) {
        const yesPrice = parseFloat(String(parsed[0]));
        if (!isNaN(yesPrice) && yesPrice >= 0 && yesPrice <= 1) {
          yesProbability = Math.round(yesPrice * 100); // 转换为百分比（0-100）
        }
      }
      // 支持对象格式：{YES: 0.75, NO: 0.25}
      else if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        if ('YES' in parsed) {
          const yesPrice = parseFloat(String(parsed.YES));
          if (!isNaN(yesPrice) && yesPrice >= 0 && yesPrice <= 1) {
            yesProbability = Math.round(yesPrice * 100);
          }
        } else if ('yes' in parsed) {
          const yesPrice = parseFloat(String(parsed.yes));
          if (!isNaN(yesPrice) && yesPrice >= 0 && yesPrice <= 1) {
            yesProbability = Math.round(yesPrice * 100);
          }
        }
      }
    } catch (parseError: any) {
      console.warn(`⚠️ [FactoryEngine] 解析 outcomePrices 失败: ${parseError.message} (marketId: ${marketId})`);
    }

    // 🚀 查询市场当前状态，检查是否需要重置 AMM Pool
    const currentMarket = await prisma.markets.findUnique({
      where: { id: marketId },
      select: {
        id: true,
        totalVolume: true,
        totalYes: true,
        totalNo: true,
      },
    });

    if (!currentMarket) {
      console.warn(`⚠️ [FactoryEngine] 市场不存在: ${marketId}`);
      return;
    }

    // 🚀 准备更新数据
    const updateData: any = {
      outcomePrices: outcomePricesJson,
      externalId: externalId, // 🔥 确保 externalId 也被更新
    };

    // 🚀 核心逻辑：如果市场尚未有用户交易（totalVolume === 0）且能解析出概率，重置 AMM Pool
    if (currentMarket.totalVolume === 0 && yesProbability !== null) {
      const INITIAL_LIQUIDITY = 1000; // 初始流动性
      const yesProb = yesProbability / 100; // 转换为 0-1 的概率（例如 75% -> 0.75）
      
      // 🚀 根据恒定乘积公式反推：
      // Price(Yes) = totalYes / (totalYes + totalNo) = yesProb
      // 总流动性 L = totalYes + totalNo = INITIAL_LIQUIDITY
      // 因此：totalYes = L * yesProb, totalNo = L * (1 - yesProb)
      const calculatedYes = INITIAL_LIQUIDITY * yesProb;
      const calculatedNo = INITIAL_LIQUIDITY * (1 - yesProb);

      updateData.totalYes = calculatedYes;
      updateData.totalNo = calculatedNo;

    } else if (currentMarket.totalVolume > 0) {

    } else if (yesProbability === null) {

    }

    // 🔥 立即更新数据库
    await prisma.markets.update({
      where: { id: marketId },
      data: updateData,
    });

    // 🔥 性能优化：删除实时同步成功日志（避免高频输出）
    // console.log(`✅ [FactoryEngine] 实时同步赔率成功: marketId=${marketId}, externalId=${externalId}`);
  } catch (error: any) {
    console.error(`❌ [FactoryEngine] 实时同步赔率失败: ${error.message} (marketId: ${marketId})`);
    // 不抛出错误，避免影响绑定流程
  }
}

/**
 * 🔥 强力匹配引擎：完全重写版本
 * 
 * 核心策略：
 * 1. 使用完整别名字典进行资产名称匹配（+100分）
 * 2. 扩大时间窗口至 ±30 分钟（防止时区/开盘延迟误差）
 * 3. 使用纯打分机制：名字命中别名 +100分，时间每差1分钟 -1分
 * 4. 自动修正：取最高分且 > 50分的候选项，直接绑定
 * 5. 绑定后立即同步赔率（Real-time Fix）
 * 
 * @param symbol 标的符号（如 "BTC/USD"）
 * @param period 周期（分钟数，仅用于日志）
 * @param endTime 结束时间（UTC）
 * @param localMarketStatus 本地市场状态（可选，用于状态一致性检查）
 * @param marketId 本地市场ID（可选，用于实时同步赔率）
 */
export async function tryBindExternalId(
  symbol: string, 
  period: number, 
  endTime: Date,
  localMarketStatus?: 'OPEN' | 'CLOSED' | 'RESOLVED' | 'CANCELED',
  marketId?: string
): Promise<string | null> {
  try {
    const assetSymbol = symbol.split('/')[0].toUpperCase();
    const endTimeMs = endTime.getTime();
    
    // 🔥 第一次尝试：使用缓存数据
    let allMarkets = await fetchMarkets(false);
    
    if (allMarkets.length === 0) {
      return null;
    }
    
    // 🔥 第一次匹配尝试
    let bestMatch = findBestMatchWithScoring(allMarkets, assetSymbol, endTimeMs, localMarketStatus);
    
    // 🔥 如果第一次匹配失败且市场是 OPEN，强制刷新缓存并重试
    if (!bestMatch && localMarketStatus === 'OPEN') {
      allMarkets = await fetchMarkets(true);
      if (allMarkets.length > 0) {
        bestMatch = findBestMatchWithScoring(allMarkets, assetSymbol, endTimeMs, localMarketStatus);
      }
    }
    
    if (bestMatch && bestMatch.market.id) {
      const matchedExternalId = String(bestMatch.market.id);
      
      // 🔥 关键新增：绑定后立即同步赔率（Real-time Fix）
      if (marketId) {
        // 异步执行，不阻塞绑定流程
        syncMarketOddsImmediately(marketId, matchedExternalId).catch(err => {
          console.error(`❌ [FactoryEngine] 实时同步赔率失败（异步）: ${err.message}`);
        });
      }
      
      return matchedExternalId;
    }
    
    return null;
  } catch (error: any) {
    console.error(`❌ [FactoryEngine] tryBindExternalId 失败: ${error.message}`);
    return null;
  }
}

/**
 * 🔥 查找最佳匹配的市场（纯打分机制）
 * 
 * 打分规则：
 * - 名字命中别名：+100分
 * - 时间每差1分钟：-1分
 * - 状态一致性：OPEN 匹配 OPEN +10分，CLOSED 匹配 CLOSED +5分
 * - 市场活跃度：有 volume +5分
 * 
 * 最终选择：最高分且 > 50分的候选项
 */
function findBestMatchWithScoring(
  markets: any[],
  assetSymbol: string,
  endTimeMs: number,
  localMarketStatus?: 'OPEN' | 'CLOSED' | 'RESOLVED' | 'CANCELED'
): { market: any; score: number } | null {
  const candidates: Array<{ market: any; score: number; timeDiff: number }> = [];
  const timeWindowMs = 30 * 60 * 1000; // 🔥 扩大窗口：±30 分钟（防止时区/开盘延迟误差）
  
  for (const m of markets) {
    // 步骤1：资产名称匹配评分（名字命中别名 +100分）
    const symbolScore = calculateSymbolMatchScore(assetSymbol, m);
    if (symbolScore === 0) {
      continue; // 名字不匹配，直接跳过
    }
    
    // 步骤2：提取结束时间
    const marketEndTime = extractEndTime(m);
    if (!marketEndTime) {
      continue;
    }
    
    const marketEndTimeMs = marketEndTime.getTime();
    const timeDiff = Math.abs(marketEndTimeMs - endTimeMs);
    
    // 步骤3：时间窗口检查（±30 分钟）
    if (timeDiff > timeWindowMs) {
      continue;
    }
    
    // 步骤4：状态一致性检查
    if (localMarketStatus === 'OPEN' && m.closed === true) {
      continue; // OPEN 市场不匹配已关闭的市场
    }
    
    // 🔥 纯打分机制：不使用 if，只用 score
    let score = symbolScore; // 基础分：名字命中别名 +100分
    
    // 🔥 关键修复：优化时间差异扣分机制，避免30分钟差异导致分数过低
    // 时间差异：每差1分钟 -0.5分（原来是 -1分，太严格）
    // 这样30分钟差异只会扣15分，而不是30分
    const timeDiffMinutes = timeDiff / (60 * 1000);
    score -= timeDiffMinutes * 0.5; // 每分钟差异扣 0.5 分（更宽松）
    
    // 状态一致性奖励
    if (localMarketStatus === 'OPEN' && m.closed === false) {
      score += 10; // OPEN 匹配 OPEN 额外加分
    }
    if (localMarketStatus === 'CLOSED' && m.closed === true) {
      score += 5; // CLOSED 匹配 CLOSED 额外加分
    }
    
    // 市场活跃度加分（如果有 volume 字段）
    if (m.volume && typeof m.volume === 'number' && m.volume > 0) {
      score += 5;
    }
    
    candidates.push({ market: m, score, timeDiff });
  }
  
  // 如果没有候选，返回 null
  if (candidates.length === 0) {
    return null;
  }
  
  // 🔥 按分数降序排序，选择最佳匹配
  candidates.sort((a, b) => b.score - a.score);
  
  const bestMatch = candidates[0];
  
  // 🔥 自动修正：取最高分且 > 50分的候选项
  // 🔥 关键修复：降低阈值到 40 分，因为时间差异扣分已优化（从-1/分钟改为-0.5/分钟）
  // 这样即使有较大的时间差异（如30分钟），只要资产名称匹配，仍能成功匹配
  if (bestMatch.score > 40) {
    return { market: bestMatch.market, score: bestMatch.score };
  }
  
  return null; // 分数过低，认为匹配不准确
}

/**
 * 记录模板失败并检查是否需要熔断
 */
async function recordFailureAndCheckCircuitBreaker(templateId: string): Promise<boolean> {
  try {
    // 获取当前模板
    const template = await prisma.market_templates.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return false;
    }

    const currentFailureCount = (template as any).failureCount || 0;
    const newFailureCount = currentFailureCount + 1;

    // 更新失败计数
    const updateData: any = {
      failureCount: newFailureCount,
    };

    // 如果达到阈值，触发熔断
    if (newFailureCount >= FAILURE_THRESHOLD) {
      updateData.status = 'PAUSED';
      updateData.isActive = false; // 同时设置 isActive 为 false
      updateData.pauseReason = '由于数据源丢失已自动熔断';
      console.warn(`🔴 [FactoryEngine] 模板 ${templateId} 触发熔断：连续失败 ${newFailureCount} 次`);
    }

    await prisma.market_templates.update({
      where: { id: templateId },
      data: updateData,
    });

    return newFailureCount >= FAILURE_THRESHOLD;
  } catch (error: any) {
    console.error(`❌ [FactoryEngine] 记录失败计数失败:`, error.message);
    return false;
  }
}

/**
 * 重置失败计数（成功创建市场后调用）
 */
async function resetFailureCount(templateId: string): Promise<void> {
  try {
    await prisma.market_templates.update({
      where: { id: templateId },
      data: {
        failureCount: 0,
        pauseReason: null,
      },
    });
  } catch (error: any) {
    console.error(`❌ [FactoryEngine] 重置失败计数失败:`, error.message);
  }
}

/**
 * 检查是否应该创建新的市场
 */
export async function shouldCreateMarket(template: MarketTemplate): Promise<boolean> {
  // 检查模板状态（优先使用 status，如果没有则使用 isActive）
  const templateStatus = (template as any).status || (template.isActive ? 'ACTIVE' : 'PAUSED');
  
  if (templateStatus === 'PAUSED' || !template.isActive) {
    return false;
  }

  // 计算下一个周期的时间点
  const nextPeriodTime = getNextPeriodTime(template.period);
  const now = new Date();
  
  // 计算距离下一个周期的时间（秒）
  const secondsUntilNextPeriod = (nextPeriodTime.getTime() - now.getTime()) / 1000;
  
  // 如果距离下一个周期的时间小于等于提前时间，则应该创建
  const shouldCreate = secondsUntilNextPeriod <= template.advanceTime && secondsUntilNextPeriod > 0;

  return shouldCreate;
}

/**
 * 为模板创建新的市场（增强版：包含 externalId 绑定和熔断逻辑）
 * 
 * @param template 市场模板
 * @param overrideEndTime 可选的结束时间覆盖（用于预生成未来市场）
 * @param initialStatus 可选的初始状态（默认 'OPEN'）
 */
export async function createMarketFromTemplate(
  template: MarketTemplate,
  overrideEndTime?: Date,
  initialStatus: 'OPEN' | 'PENDING' = 'OPEN'
): Promise<string> {
  try {
    // 🔥 性能优化：删除高频日志（市场创建不是高频操作，但保留错误日志）
    // console.log(`🏗️ [FactoryEngine] 开始为模板 ${template.name} 创建市场...`);

    // 2. 计算结束时间（下一个周期的时间点）- 严格对齐周期边界
    // 🔥 如果提供了 overrideEndTime，使用它（用于预生成未来市场）
    let endTime = overrideEndTime || getNextPeriodTime(template.period);
    
    // 🔥 修复：增加 60 分钟偏移量，确保生成的时间与 Polymarket 的整点时间一致
    // 之前诊断发现我们生成的 closingDate 比 Polymarket 实际时间早了 60 分钟
    endTime = new Date(endTime.getTime() + 60 * 60 * 1000); // 增加 60 分钟（1小时）
    // 🔥 性能优化：删除高频日志
    // console.log(`🕐 [FactoryEngine] 时间偏移：原始结束时间已增加 60 分钟，新结束时间=${endTime.toISOString()}`);
    
    // 🔥 计算开始时间：StartTime = EndTime - 周期时间
    const startTime = getStartTime(endTime, template.period);
    
    // 🔧 关键修复：必须对齐到周期边界！不能直接用startTime，因为可能不对齐
    // 对齐逻辑：复制trigger/route.ts中的alignToPeriodBoundary函数逻辑
    const alignedStartTimeRaw = new Date(startTime);
    alignedStartTimeRaw.setUTCSeconds(0);
    alignedStartTimeRaw.setUTCMilliseconds(0);
    
    let alignedStartTime: Date;
    if (template.period === 15) {
      const minutes = alignedStartTimeRaw.getUTCMinutes();
      const alignedMinutes = Math.floor(minutes / 15) * 15;
      alignedStartTime = new Date(alignedStartTimeRaw);
      alignedStartTime.setUTCMinutes(alignedMinutes);
    } else if (template.period === 60) {
      alignedStartTime = new Date(alignedStartTimeRaw);
      alignedStartTime.setUTCMinutes(0);
    } else if (template.period === 240) {
      const hours = alignedStartTimeRaw.getUTCHours();
      const alignedHours = Math.floor(hours / 4) * 4;
      alignedStartTime = new Date(alignedStartTimeRaw);
      alignedStartTime.setUTCHours(alignedHours);
      alignedStartTime.setUTCMinutes(0);
    } else if (template.period === 1440) {
      alignedStartTime = new Date(alignedStartTimeRaw);
      alignedStartTime.setUTCHours(0);
      alignedStartTime.setUTCMinutes(0);
    } else {
      const totalMinutes = alignedStartTimeRaw.getUTCHours() * 60 + alignedStartTimeRaw.getUTCMinutes();
      const alignedTotalMinutes = Math.floor(totalMinutes / template.period) * template.period;
      alignedStartTime = new Date(alignedStartTimeRaw);
      alignedStartTime.setUTCHours(Math.floor(alignedTotalMinutes / 60));
      alignedStartTime.setUTCMinutes(alignedTotalMinutes % 60);
    }
    
    // 🔧 修复1：立即计算isPast，如果是过去场次，立即处理，不执行任何复杂逻辑
    // 1. 严格的时间判断（必须用UTC）
    const startMoment = dayjs.utc(alignedStartTime);
    const nowMoment = dayjs.utc();
    const isPast = startMoment.isBefore(nowMoment);
    
    // 🔧 关键修复：如果endTime已经过去，也认为是过去场次（双保险）
    const endMoment = dayjs.utc(endTime);
    const isPastByEndTime = endMoment.isBefore(nowMoment);
    const finalIsPast = isPast || isPastByEndTime;
    
    // 2. 强制状态定义（不要相信传入的initialStatus，在这里重新算）
    // 如果是过去的时间，状态必须是CLOSED，绝不可能是OPEN
    // 🔧 关键修复：使用finalIsPast（同时检查startTime和endTime）
    // 注意：Prisma schema中MarketStatus没有PENDING，使用CLOSED表示过去场次
    const finalStatus = finalIsPast ? 'CLOSED' : 'OPEN';

    // 🔧 修复1：历史场次快速路径 - 绝对禁止调用Oracle或复杂逻辑，防止崩溃
    // 🔧 关键修复：使用finalIsPast而不是isPast
    if (finalIsPast) {
      // 🔥 性能优化：删除高频日志
      // console.log(`🔴 [FactoryEngine] 历史场次快速路径：跳过所有外部API调用，直接创建CLOSED状态市场 (endTime=${endTime.toISOString()}, now=${nowMoment.toISOString()})`);
      
      // 🔧 幂等性检查：基于closingDate（endTime）查找已存在的市场
      // 🔥 修复：使用精确匹配而不是范围检查，防止重复生成
      // 工厂市场的 closingDate 应该严格对齐到周期边界，使用精确匹配
      const existingMarket = await prisma.markets.findFirst({
        where: {
          templateId: template.id,
          isFactory: true,
          // 🔥 精确匹配：去除毫秒差异，对齐到秒级别
          closingDate: {
            gte: new Date(endTime.getTime() - 100), // ±100ms 容差，处理数据库精度问题
            lte: new Date(endTime.getTime() + 100),
          },
        },
        orderBy: {
          createdAt: 'desc', // 如果有多个，取最新的
        },
      });

      if (existingMarket) {

        return existingMarket.id;
      }
      
      // 快速创建历史场次 - 使用最小数据集，避免任何可能的崩溃
      const marketTitle = template.name;
      const periodLabel = template.period === 15 ? '15分钟' : 
                         template.period === 60 ? '1小时' : 
                         template.period === 240 ? '4小时' :
                         template.period === 1440 ? '1天' :
                         `${template.period}分钟`;
      
      // 确定分类（简化逻辑）
      const baseCategorySlug = template.categorySlug || 'crypto';
      const periodMap: Record<number, string> = {
        15: '15m',
        60: '1h',
        240: '4h',
        1440: 'daily',
      };
      const periodSlug = periodMap[template.period] || null;
      const categorySlug = periodSlug ? `${baseCategorySlug}-${periodSlug}` : baseCategorySlug;
      
      // 🔥 根据 symbol 设置正确的图标 URL（防止图标混乱）
      const symbolUpper = template.symbol.toUpperCase();
      let iconUrl: string | null = null;
      if (symbolUpper.includes('BTC') || symbolUpper.includes('BITCOIN')) {
        iconUrl = 'https://cryptologos.cc/logos/bitcoin-btc-logo.png';
      } else if (symbolUpper.includes('ETH') || symbolUpper.includes('ETHEREUM') || symbolUpper.includes('ETHER')) {
        iconUrl = 'https://cryptologos.cc/logos/ethereum-eth-logo.png';
      }
      
      const newMarket = await prisma.markets.create({
        data: {
          id: randomUUID(),
          updatedAt: new Date(),
          title: marketTitle,
          description: '历史场次，价格待同步',
          symbol: template.symbol,
          strikePrice: 0, // 🔴 强制锁死价格，防止API报错
          closingDate: endTime,
          status: 'CLOSED', // 🔴 强制锁死状态（过去场次使用CLOSED，因为Prisma schema没有PENDING）
          reviewStatus: 'PUBLISHED',
          isActive: true,
          isFactory: true,
          source: 'INTERNAL',
          externalId: null, // 历史场次不需要externalId
          categorySlug: categorySlug,
          templateId: template.id,
          period: template.period,
          image: iconUrl,   // 🔥 根据 symbol 设置正确的图标 URL
          iconUrl: iconUrl, // 🔥 同时设置 iconUrl 字段，确保兼容性
        },
      });
      
      // 🔥 性能优化：删除高频日志
      // console.log(`✅ [FactoryEngine] 历史场次创建成功（快速路径）: ${newMarket.id}, status=CLOSED, strikePrice=0`);
      
      // 更新模板记录
      await prisma.market_templates.update({
        where: { id: template.id },
        data: {
          lastMarketId: newMarket.id,
          lastCreatedAt: new Date(),
        },
      });
      
      return newMarket.id;
    }
    
    // 以下逻辑仅用于未来场次（OPEN状态）
    
    // 🔥 幂等性物理加锁：在创建前检查 templateId + closingDate（仅用于未来场次）
    // 注意：历史场次的幂等性检查已经在快速路径中完成
    // 🔥 修复：使用精确匹配而不是范围检查，防止重复生成
    const existingMarketFuture = await prisma.markets.findFirst({
      where: {
        templateId: template.id,
        isFactory: true,
        // 🔥 精确匹配：去除毫秒差异，对齐到秒级别（±100ms 容差，处理数据库精度问题）
        closingDate: {
          gte: new Date(endTime.getTime() - 100),
          lte: new Date(endTime.getTime() + 100),
        },
      },
      orderBy: {
        createdAt: 'desc', // 如果有多个，取最新的
      },
    });

    if (existingMarketFuture) {

      return existingMarketFuture.id;
    }

    // 1. 🔥 市价起跑逻辑：获取起始价格（startingPrice/起跑线）
    // 🚀 注意：这段代码只会在finalIsPast为false时执行（快速路径已经处理了过去场次）
    let startingPrice: number = 0;
    let polymarketId: string | null = null;
    
    // 未来的场次：正常获取价格
    // 双重取价兜底：优先从Polymarket获取line值，失败则从Oracle获取实时市价
    startingPrice = await getStartingPrice(template);

    // 5. 🔥 拉链式精准绑定：根据标的和结束时间严格匹配 Polymarket 市场
    // 支持预绑定：对未来的市场也有效
    try {
      // 🔥 使用强力匹配引擎：根据 symbol、period 和 endTime 匹配
      // 传递本地市场状态，用于状态一致性检查
      // 注意：这里暂时不传 marketId，因为市场还未创建，创建后会再次调用同步
      polymarketId = await tryBindExternalId(template.symbol, template.period, endTime, finalStatus as 'OPEN' | 'CLOSED' | 'RESOLVED' | 'CANCELED');
      
      if (polymarketId) {
        // 🔥 性能优化：删除高频日志
        // console.log(`✅ [FactoryEngine] 动态匹配成功: externalId=${polymarketId}`);
      } else {
        console.warn(`⚠️ [FactoryEngine] 动态匹配失败，市场将在创建后由赔率机器人同步（如果 Polymarket 开启下一期）`);
      }
    } catch (bindError: any) {
      // externalId获取失败不影响市场创建，只记录警告
      console.warn(`⚠️ [FactoryEngine] 动态ID匹配失败: ${bindError.message}（将继续创建市场）`);
    }
    
    // 🚀 修复：确保finalPrice已定义（未来场次使用获取到的价格）
    // 注意：如果是过去场次，应该已经在快速路径中return，不会执行到这里
    const finalPrice = startingPrice || 0;
    
    // 3. 生成市场标题
    // 🔥 计算周期标签（在所有分支中使用）
    const periodLabel = template.period === 15 ? '15分钟' : 
                       template.period === 60 ? '1小时' : 
                       template.period === 240 ? '4小时' :
                       template.period === 1440 ? '1天' :
                       template.period === 10080 ? '1周' :
                       template.period === 43200 ? '1月' :
                       `${template.period}分钟`;
    
    // 🔥 格式化为 HH:mm（统一格式）
    const formatTime = (date: Date): string => {
      return date.toLocaleString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false, // 使用24小时制
      });
    };
    
    const startTimeStr = formatTime(startTime); // HH:mm 格式
    const endTimeStr = formatTime(endTime); // HH:mm 格式
    
    // 强制逻辑：市场标题 = 模板里你亲手写的名字
    // 严禁任何自动拼接，严禁抓取外部标题
    const marketTitle = template.name;

    // 4. 确定父分类slug（crypto 或 finance）
    const baseCategorySlug = template.categorySlug || 'crypto'; // crypto 或 finance

    // 🔥 生成唯一的slug（格式：${symbol}-${period}-${Date.now()}）
    // 例如：btc-15m-1234567890
    const assetSymbol = template.symbol.split('/')[0].toLowerCase(); // BTC/USD -> btc
    const periodSlugForMarket: Record<number, string> = {
      15: '15m',
      60: '1h',
      240: '4h',
      1440: 'daily',
      10080: 'weekly',
      43200: 'monthly',
    };
    const periodSlugPart = periodSlugForMarket[template.period] || `${template.period}m`;
    const marketSlug = `${assetSymbol}-${periodSlugPart}-${Date.now()}`;

    // 6. 生成description（显示起始参考价和周期信息）
    // 🚀 修复：基于finalStatus使用特殊描述
    const description = (finalStatus as string) === 'PENDING'
      ? `历史场次，价格待同步`
      : finalPrice > 0 
      ? `${template.symbol} ${periodLabel}周期预测市场，起始参考价: $${finalPrice.toFixed(2)}，时间窗口: ${startTimeStr} - ${endTimeStr}`
      : `${template.symbol} ${periodLabel}周期预测市场，时间窗口: ${startTimeStr} - ${endTimeStr}（价格待更新）`;

    // 7. 🔥 只读匹配：仅使用 findUnique 查找现有分类，禁止创建
    // 步骤1：根据period映射到分类slug
    const periodMap: Record<number, string> = {
      15: '15m',
      60: '1h',
      240: '4h',
      1440: 'daily',
      10080: 'weekly',
      43200: 'monthly',
    };
    const periodSlug = periodMap[template.period] || null;
    
    // 步骤2：构建完整的分类slug（如 'crypto-15m'）
    let categorySlug: string | null = null;
    if (periodSlug) {
      categorySlug = `${baseCategorySlug}-${periodSlug}`;
    } else {
      // 如果没有周期映射，使用父分类slug
      categorySlug = baseCategorySlug;
    }
    
    // 步骤3：只读匹配：仅使用 findUnique 查找现有分类
    let categoryRecord = null;
    if (categorySlug) {
      categoryRecord = await prisma.categories.findUnique({
        where: { slug: categorySlug },
      });
      
      if (categoryRecord) {

      } else {
        console.warn(`⚠️ [FactoryEngine] 未找到分类 '${categorySlug}'，将跳过分类关联（市场将出现在"所有市场"中）`);
      }
    }

    // 🔥 根据 symbol 设置正确的图标 URL（防止图标混乱）
    // 提取为共享函数，避免代码重复
    const getIconUrlBySymbol = (symbol: string): string | null => {
      const symbolUpper = symbol.toUpperCase();
      if (symbolUpper.includes('BTC') || symbolUpper.includes('BITCOIN')) {
        return 'https://cryptologos.cc/logos/bitcoin-btc-logo.png';
      }
      if (symbolUpper.includes('ETH') || symbolUpper.includes('ETHEREUM') || symbolUpper.includes('ETHER')) {
        return 'https://cryptologos.cc/logos/ethereum-eth-logo.png';
      }
      // 其他币种可以根据需要扩展
      return null;
    };
    
    const iconUrl = getIconUrlBySymbol(template.symbol);

    // 8. 构建完整的data对象（不要精简，必须填入所有字段）
    // 🚀 核心修复：在prisma.create的前一刻，使用现场计算的finalStatus和finalPrice，绝不使用initialStatus
    const data: any = {
      title: marketTitle,
      description: description,
      symbol: template.symbol,             // 必须传，不能省！
      strikePrice: Number(finalPrice),     // 🚀 关键！使用现场计算的finalPrice（过去场次为0）
      closingDate: endTime,                 // 必须传！用于幂等性检查（templateId + closingDate 唯一标识）
      status: finalStatus,                  // 🚀 关键！使用现场计算的finalStatus（过去场次为CLOSED）
      reviewStatus: 'PUBLISHED',            // 🔥 必须设为PUBLISHED，确保前端可见
      isActive: true,                       // 🔥 必须设为true，确保市场处于激活状态
      isFactory: true,                      // 必须传！
      source: 'INTERNAL',                   // 必须传！
      externalId: polymarketId,             // 必须传！（PENDING状态时为null）
      categorySlug: categorySlug || null,   // 使用分类 slug（可能为 null）
      templateId: template.id,              // 🔥 必须关联模板ID，用于导航栏聚合和幂等性检查
      period: template.period,              // 🔥 必须携带周期，用于导航栏显示
      image: iconUrl,                       // 🔥 根据 symbol 设置正确的图标 URL
      iconUrl: iconUrl,                     // 🔥 同时设置 iconUrl 字段，确保兼容性
    };
    
    // 🚀 最终验证：确保status确实是计算后的finalStatus
    if (data.status !== finalStatus) {
      console.error(`❌ [FactoryEngine] 严重错误：status被覆盖！期望=${finalStatus}, 实际=${data.status}，强制修正`);
      data.status = finalStatus;
    }
    
    // 🔥 性能优化：删除高频日志
    // console.log(`✅ [FactoryEngine] 准备创建市场: status=${data.status}, strikePrice=${data.strikePrice}, finalIsPast=${finalIsPast}`);
    
    // 🔥 兜底逻辑：如果找到分类，才创建 MarketCategory 关联；否则跳过
    if (categoryRecord) {
      data.categories = {
        create: [
          {
            category: { connect: { id: categoryRecord.id } } // 🔥 只读匹配：仅连接现有分类
          }
        ]
      };
    } else {
      // 🔥 性能优化：删除高频日志
      // console.log(`ℹ️ [FactoryEngine] 跳过 MarketCategory 创建（分类不存在），市场将出现在"所有市场"中`);
    }

    // 9. 验收日志：打印完整的payload，确保包含 strikePrice 和 symbol
    // 🔥 性能优化：仅在开发环境或需要调试时输出（JSON.stringify 可能很慢）
    // console.log('FINAL_CHECK_PAYLOAD:', JSON.stringify(data, null, 2));

    // 🔥 漏洞4修复：工厂市场创建时也要真实注入流动性
    // 全局默认注入额度（可通过环境变量配置，默认 $500）
    const DEFAULT_FACTORY_LIQUIDITY = parseFloat(process.env.DEFAULT_FACTORY_LIQUIDITY || '500');
    // 🔥 修复3：极端价格保护 - 设置最小初始流动性（防止K值过小导致滑点过大）
    const MIN_INITIAL_LIQUIDITY = parseFloat(process.env.MIN_INITIAL_LIQUIDITY || '100');
    
    // 如果默认流动性小于最小值，使用最小值（防止极端价格）
    const actualLiquidity = Math.max(DEFAULT_FACTORY_LIQUIDITY, MIN_INITIAL_LIQUIDITY);
    const shouldInjectLiquidity = actualLiquidity > 0;
    
    if (DEFAULT_FACTORY_LIQUIDITY < MIN_INITIAL_LIQUIDITY) {
      console.warn(`⚠️ [FactoryEngine] 默认流动性 $${DEFAULT_FACTORY_LIQUIDITY} 小于最小值 $${MIN_INITIAL_LIQUIDITY}，已自动调整为 $${actualLiquidity}（防止极端价格）`);
    }

    // 10. 使用事务确保市场创建和流动性注入的原子性
    const newMarket = await prisma.$transaction(async (tx) => {
      // 创建市场
      const createdMarket = await tx.markets.create({
        data: {
          ...data,
          id: randomUUID(),
          updatedAt: new Date(),
          // 🔥 漏洞4修复：如果启用流动性注入，初始化 totalYes 和 totalNo（默认 50/50）
          totalYes: shouldInjectLiquidity ? actualLiquidity * 0.5 : 0,
          totalNo: shouldInjectLiquidity ? actualLiquidity * 0.5 : 0,
        },
      });

      // 🔥 漏洞4修复：如果启用流动性注入，执行真实扣款和记录流水
      if (shouldInjectLiquidity) {
        // 获取流动性账户
        const liquidityAccount = await tx.users.findFirst({
          where: { email: 'system.liquidity@yesno.com' },
        });

        if (!liquidityAccount) {
          // 如果流动性账户不存在，记录警告但不阻止市场创建
          console.warn(`⚠️ [FactoryEngine] 流动性账户不存在，跳过流动性注入。市场 ${createdMarket.id} 将没有初始流动性。`);
        } else {
          // 检查余额
          if (liquidityAccount.balance < actualLiquidity) {
            // 🔥 漏洞4修复：如果余额不足，记录错误但不阻止市场创建（允许空头创建）
            console.error(`❌ [FactoryEngine] 流动性账户余额不足：当前余额 $${liquidityAccount.balance.toFixed(2)}，需要 $${actualLiquidity.toFixed(2)}。市场 ${createdMarket.id} 将没有初始流动性。`);
          } else {
            // 🔥 漏洞1修复：获取或创建AMM账户
            let ammAccount = await tx.users.findFirst({
              where: { email: 'system.amm@yesno.com' },
            });

            if (!ammAccount) {
              // 如果AMM账户不存在，创建它
              ammAccount = await tx.users.create({
                data: {
                  id: randomUUID(),
                  updatedAt: new Date(),
                  email: 'system.amm@yesno.com',
                  balance: 0,
                  isAdmin: false,
                  isBanned: false,
                },
              });
            }

            // 🔥 漏洞2修复：使用余额法确保精度（Yes+No=总额）
            // 默认 50/50 分配
            const yesProb = 0.5;
            // 先计算Yes（保留2位小数）
            const calculatedYes = Math.floor(actualLiquidity * yesProb * 100) / 100;
            // No = 总额 - Yes（确保总额绝对等于注入金额）
            const calculatedNo = actualLiquidity - calculatedYes;

            // 🔥 漏洞1修复：从流动性账户扣减余额
            const updatedLiquidityAccount = await tx.users.update({
              where: { id: liquidityAccount.id },
              data: {
                balance: {
                  decrement: actualLiquidity,
                },
              },
            });

            // 🔥 漏洞1修复：给AMM账户增加余额（资金从LP转移到AMM）
            const updatedAmmAccount = await tx.users.update({
              where: { id: ammAccount.id },
              data: {
                balance: {
                  increment: actualLiquidity,
                },
              },
            });

            // 🔥 漏洞2修复：更新市场的totalYes和totalNo（使用精确计算的值）
            // 🔥 计算AMM恒定乘积常数 K = totalYes * totalNo
            const ammK = calculatedYes * calculatedNo;
            
            await tx.markets.update({
              where: { id: createdMarket.id },
              data: {
                totalYes: calculatedYes,
                totalNo: calculatedNo,
                ammK: ammK, // 🔥 记录AMM恒定乘积常数
                initialLiquidity: actualLiquidity, // 🔥 记录初始注入金额（用于结算时本金回收校准）
              },
            });

            // 创建 Transaction 记录（LP账户：负数表示支出）
            await tx.transactions.create({
              data: {
                id: randomUUID(),
                userId: liquidityAccount.id,
                amount: -actualLiquidity,
                type: 'ADMIN_ADJUSTMENT',
                reason: `工厂市场创建初始流动性注入 - 市场ID: ${createdMarket.id}`,
                status: 'COMPLETED',
              },
            });

            // 🔥 漏洞1修复：创建AMM账户的Transaction记录（正数表示收入）
            await tx.transactions.create({
              data: {
                id: randomUUID(),
                userId: ammAccount.id,
                amount: actualLiquidity,
                type: 'ADMIN_ADJUSTMENT',
                reason: `工厂市场创建初始流动性注入 - 市场ID: ${createdMarket.id}`,
                status: 'COMPLETED',
              },
            });

            console.log(`✅ [FactoryEngine] 流动性注入成功: 市场 ${createdMarket.id}, 金额 $${actualLiquidity}, LP账户余额: $${updatedLiquidityAccount.balance}, AMM账户余额: $${updatedAmmAccount.balance}`);
          }
        }
      }

      return createdMarket;
    });

    const newMarketId = newMarket.id;
    // 🔥 性能优化：删除高频日志（市场创建详细信息）
    // console.log(`✅ [FactoryEngine] 市场创建成功: ${newMarketId}`);
    // console.log(`   - 标题: ${marketTitle}`);
    // console.log(`   - 标的: ${template.symbol}`);
    // console.log(`   - 周期: ${template.period}分钟`);
    // console.log(`   - 起始价: $${finalPrice.toFixed(2)} (${finalIsPast ? '历史场次，价格待同步' : '实时价格'})`);
    // console.log(`   - 分类: ${categorySlug}`);
    // console.log(`   - PolymarketID: ${polymarketId || '未设置'}`);

    // 🔥 关键新增：如果绑定成功，创建市场后立即同步赔率（Real-time Fix）
    if (polymarketId) {
      // 异步执行，不阻塞市场创建流程
      syncMarketOddsImmediately(newMarketId, polymarketId).catch(err => {
        console.error(`❌ [FactoryEngine] 实时同步赔率失败（异步）: ${err.message}`);
      });
    }

    // 8. 更新模板的最后创建时间（市场创建成功即更新，无论externalId是否获取成功）
    await prisma.market_templates.update({
      where: { id: template.id },
      data: {
        lastMarketId: newMarketId,
        lastCreatedAt: new Date(),
      },
    });

    // 7. 重置失败计数（市场创建成功，无论externalId是否绑定）
    await resetFailureCount(template.id);

    return newMarketId;
  } catch (error: any) {
    console.error(`❌ [FactoryEngine] 创建市场失败:`, error.message);
    // 🚀 修复：对于PENDING状态的市场，创建失败不应该触发熔断
    // 因为PENDING市场已经跳过了价格获取，理论上不应该失败
    // 但如果真的失败了（比如数据库错误），也应该记录但不触发熔断，让后续场次继续创建
    // 只在OPEN状态的市场创建失败时，才考虑触发熔断
    // 注意：这里仍然抛出错误，让上层（trigger/route.ts）决定是否继续
    throw error;
  }
}

/**
 * 检查所有激活的模板并创建市场
 */
export async function checkAndCreateMarkets(): Promise<void> {
  try {

    // 获取所有激活的模板（排除已熔断的）
    // 🔥 查询条件：isActive = true 且 (status = ACTIVE 或 status 为 null，兼容旧数据)
    const templates = await prisma.market_templates.findMany({
      where: {
        isActive: true,
        OR: [
          { status: 'ACTIVE' },
          { status: null as any }, // 兼容旧数据（没有 status 字段的模板）
        ],
      },
    });

    for (const template of templates) {
      try {
        const shouldCreate = await shouldCreateMarket(template as MarketTemplate);
        
        if (shouldCreate) {
          // 检查是否已经创建过（避免重复创建）
          if ((template as any).lastCreatedAt) {
            const timeSinceLastCreate = Date.now() - (template as any).lastCreatedAt.getTime();
            const halfPeriod = (template.period * 60 * 1000) / 2;
            
            if (timeSinceLastCreate < halfPeriod) {

              continue;
            }
          }

          await createMarketFromTemplate(template as MarketTemplate);

        }
      } catch (error: any) {
        console.error(`❌ [FactoryEngine] 处理模板 ${template.name} 失败:`, error.message);
        // 继续处理其他模板，不中断整个流程
      }
    }
  } catch (error: any) {
    console.error('❌ [FactoryEngine] 检查模板失败:', error.message);
    throw error;
  }
}
