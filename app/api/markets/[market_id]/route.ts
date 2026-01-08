import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DBService } from '@/lib/dbService';
import { extractUserIdFromToken } from '@/lib/authUtils'; // 强制数据隔离：使用统一的 userId 提取函数
import { prisma } from '@/lib/prisma';
import { calculateDisplayVolume } from '@/lib/marketUtils';
import { createNoCacheResponse } from '@/lib/responseHelpers'; // 🔥 使用禁用缓存的响应帮助函数

// 🔥 强制清理前端缓存：确保不使用旧缓存
export const dynamic = 'force-dynamic';

/**
 * 市场详情 API
 * GET /api/markets/[market_id]
 * 
 * 返回指定市场的详细信息
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {

    const { market_id } = await params;
    
    // 打印 Slug：确保 API 能够正确获取并打印 URL 中的市场标识符

    if (!market_id || market_id.trim() === '') {
      console.error('❌ [Market Detail API] 市场ID为空');
      return createNoCacheResponse(
        {
          success: false,
          error: 'Market ID is required',
        },
        400
      );
    }

    // 🔥 P0修复：先不使用include marketTemplate，直接查询Market表（字段在schema中已定义）
    // 如果关联有问题，后续可以手动查询template
    const market = await prisma.markets.findUnique({
      where: { id: market_id },
      include: {
          market_categories: {
          include: {
            categories: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!market) {
      console.error('❌ [Market Detail API] 市场不存在:', market_id);
      return createNoCacheResponse({ success: false, error: 'Market not found' }, 404);
    }

    // 🔥 修复：放宽检查条件，允许状态为 OPEN 的市场访问（即使 reviewStatus 不是 PUBLISHED）
    // 检查市场是否激活，如果未激活则返回 404
    if (!market.isActive) {
      console.error('❌ [Market Detail API] 市场未激活:', market_id, { reviewStatus: market.reviewStatus, isActive: market.isActive });
      return createNoCacheResponse({ success: false, error: 'Market not available' }, 404);
    }
    
    // 🔥 修复：如果市场状态不是 OPEN，也返回 404（已关闭或已结算的市场不应该访问）
    if (market.status !== 'OPEN') {
      console.error('❌ [Market Detail API] 市场状态不是 OPEN:', market_id, { status: market.status });
      return createNoCacheResponse({ success: false, error: 'Market not available' }, 404);
    }
    
    // 2. 组装返回数据
    const categories = market.market_categories?.map((mc: any) => mc.categories) || [];
    
    // 🔥 P0修复：手动查询marketTemplate（如果templateId存在）
    let marketTemplate = null;
    if ((market as any).templateId) {
      try {
        marketTemplate = await prisma.market_templates.findUnique({
          where: { id: (market as any).templateId },
        });
      } catch (error) {
        console.warn('⚠️ [Market Detail API] 查询marketTemplate失败:', error);
        // 继续执行，marketTemplate保持为null
      }
    }
    
    const formattedMarket = {
      id: market.id,
      title: market.title,
      titleZh: (market as any).titleZh || null, // 🔥 修复：添加中文标题字段
      description: market.description,
      descriptionZh: (market as any).descriptionZh || null, // 🔥 修复：添加中文描述字段
      closingDate: (() => {
        try {
          if (!market.closingDate) {
            return new Date().toISOString();
          }
          const isoString = market.closingDate.toISOString();
          // 🔥 验证日期有效性
          const testDate = new Date(isoString);
          if (isNaN(testDate.getTime())) {
            console.warn(`⚠️ [Market Detail API] 无效的 closingDate，使用当前时间 (ID: ${market.id})`);
            return new Date().toISOString();
          }
          return isoString;
        } catch (e) {
          console.error(`❌ [Market Detail API] closingDate 转换错误 (ID: ${market.id}):`, e);
          return new Date().toISOString();
        }
      })(),
      resolvedOutcome: market.resolvedOutcome,
      status: market.status,
      totalVolume: market.totalVolume,
      totalYes: market.totalYes,
      totalNo: market.totalNo,
      feeRate: market.feeRate,
      category: categories[0]?.category?.name || market.category || undefined,
      categorySlug: categories[0]?.category?.slug || market.categorySlug || undefined,
      createdAt: market.createdAt.toISOString(),
      source: market.source || 'INTERNAL',
      externalVolume: market.externalVolume ?? 0,
      internalVolume: market.internalVolume ?? 0,
      manualOffset: market.manualOffset ?? 0,
      isActive: market.isActive ?? true,
      // 🔥 P0修复：直接使用Market表的字段（schema已定义），如果templateId存在则查询template
      isFactory: (market as any).isFactory ?? false,
      period: (market as any).period ?? marketTemplate?.period ?? null,
      templateId: (market as any).templateId ?? null,
      factoryId: null, // 🔥 临时移除：数据库中没有factoryId字段
      template: marketTemplate,
      // 其他字段
      outcomePrices: market.outcomePrices || null,
      image: market.image || null,
      iconUrl: market.iconUrl || null,
      initialPrice: market.initialPrice ? Number(market.initialPrice) : null,
      volume24h: market.volume24h ? Number(market.volume24h) : null,
      externalId: market.externalId || null,
      strikePrice: market.strikePrice || null,
      symbol: market.symbol || null,
    } as any;

    // 修复详情页订单列表：获取当前用户在该市场的订单
    // 审计后端 API：确保获取用户持仓数据的 API 在用户没有持仓时，返回一个空的持仓数组，而不是旧的或无效的数据
    // 强制 DB 过滤：确保所有数据库查询都包含 WHERE user_id = current_user_id，确保数据隔离在源头实现
    let userOrders: any[] = [];
    let userPosition: { yesShares: number; noShares: number; yesAvgPrice: number; noAvgPrice: number } | null = null;
    
    try {
      // 强制身份过滤：从 Auth Token 提取 current_user_id
      const authResult = await extractUserIdFromToken();
      
      if (authResult.success && authResult.userId) {
        const userId = authResult.userId;
        
        // 硬编码检查：验证 userId 不是硬编码值，必须从 Auth Token 提取
        if (!userId || typeof userId !== 'string' || userId.trim() === '') {
          console.error('❌ [Market Detail API] userId 验证失败：userId 为空或无效');
          userOrders = [];
          userPosition = null;
        } else {
          // ========== 修复：从Position表查询持仓，不再从Order数组计算 ==========
          // 强制规则：UI的"我的持仓"100%只能来自Position表，不允许从Trade计算
          const { prisma } = await import('@/lib/prisma');
          
          const yesPosition = await prisma.positions.findFirst({
            where: {
              userId,
              marketId: market_id,
              outcome: 'YES',
              status: 'OPEN', // ========== 强制规则：只查询OPEN状态的持仓 ==========
            },
          });
          
          const noPosition = await prisma.positions.findFirst({
            where: {
              userId,
              marketId: market_id,
              outcome: 'NO',
              status: 'OPEN', // ========== 强制规则：只查询OPEN状态的持仓 ==========
            },
          });
          
          // 构建userPosition对象
          if (yesPosition || noPosition) {
            userPosition = {
              yesShares: yesPosition?.shares || 0,
              noShares: noPosition?.shares || 0,
              yesAvgPrice: yesPosition?.avgPrice || 0,
              noAvgPrice: noPosition?.avgPrice || 0,
            };
          }
          
          // 获取用户订单（用于显示交易历史，不是用于计算持仓）
          const allUserOrders = await DBService.findOrdersByUserId(userId);
          userOrders = allUserOrders.filter(order => order.marketId === market_id);

        }
      } else {
        // 如果 Token 无效或缺失，记录警告但不返回错误（允许未登录用户查看市场）
        console.warn('⚠️ [Market Detail API] Token 无效或缺失，不返回用户订单数据');
        userOrders = [];
        userPosition = null;
      }
    } catch (error) {
      console.error('❌ [Market Detail API] 获取用户订单失败:', error);
      // 如果获取订单失败，继续返回市场数据，但不包含用户订单
      // 审计后端 API：确保在用户没有持仓时，返回一个空的持仓数组
      userOrders = [];
      userPosition = null;
    }

    // 使用 formattedMarket 继续处理
    const marketData = formattedMarket!;
    
    // 🔥 关键调试：检查 formattedMarket 中的关键字段

    // 🔥 核心分流逻辑：赔率不是算出来的，是同步过来的！
    // 
    // 1. 如果 externalId 匹配成功（POLYMARKET 市场或工厂市场有 externalId）：
    //    - 必须强制覆盖本地的 50/50，使用从 Polymarket 同步的实时赔率
    //    - 如果 Polymarket 尚未开启下一期（提前生成），则暂时显示 50/50，直到 Polymarket 开启后立即同步
    //
    // 2. 结算依然归 Oracle：赔率看 Polymarket 的（市场情绪），结算看本地 Oracle 的（真实价格）
    //
    // 3. 废除 Oracle 偏移算法：不再使用 BTC 价格涨跌来模拟赔率
    let yesPercent = 50;
    let noPercent = 50;
    
    // 🔥 检查是否为需要同步赔率的市场（POLYMARKET 或工厂市场）
    const isPolymarketMarket = marketData.source === 'POLYMARKET';
    const isFactoryMarket = (marketData as any).isFactory === true;
    const hasExternalId = !!(marketData as any).externalId;
    // 🔥 修复：工厂市场无论是否有 externalId，都尝试使用同步赔率（如果有数据的话）
    const shouldUseSyncedOdds = isPolymarketMarket || isFactoryMarket;
    
    // 🔥 调试日志：检查工厂市场判断

    if (shouldUseSyncedOdds) {
      // 🚀 强制使用同步赔率：如果有数据，必须强制覆盖本地的 50/50
      let syncedOddsFound = false;
      
      // 第一优先级：使用 outcomePrices（从赔率机器人同步的实时赔率）
      try {
        const outcomePrices = (marketData as any).outcomePrices;

        if (outcomePrices) {
          const parsed = typeof outcomePrices === 'string' ? JSON.parse(outcomePrices) : outcomePrices;
          
          let yesPrice: number | null = null;
          let noPrice: number | null = null;
          
          // 支持数组格式：[0.7, 0.3] 或 ["0.7", "0.3"]
          if (Array.isArray(parsed) && parsed.length >= 2) {
            yesPrice = parseFloat(String(parsed[0]));
            noPrice = parseFloat(String(parsed[1]));
          }
          // 支持对象格式：{ YES: 0.7, NO: 0.3 } 或 { "YES": "0.7", "NO": "0.3" }
          else if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            if ('YES' in parsed) {
              yesPrice = parseFloat(String(parsed.YES));
            } else if ('yes' in parsed) {
              yesPrice = parseFloat(String(parsed.yes));
            }
            if ('NO' in parsed) {
              noPrice = parseFloat(String(parsed.NO));
            } else if ('no' in parsed) {
              noPrice = parseFloat(String(parsed.no));
            }
          }
          
          // 🔥 调试日志：打印解析后的原始价格值

          // 🔥 移除结算状态检查：允许显示真实的Polymarket赔率，包括0/100（已结算市场）
          // 确保实时同步Polymarket的真实赔率数据
          if (yesPrice !== null && !isNaN(yesPrice) && yesPrice >= 0 && yesPrice <= 1) {
            yesPercent = yesPrice * 100;
            // 如果对象格式有明确的 NO 价格，使用它；否则计算
            if (noPrice !== null && !isNaN(noPrice) && noPrice >= 0 && noPrice <= 1) {
              noPercent = noPrice * 100;
            } else {
              noPercent = (1 - yesPrice) * 100;
            }
            syncedOddsFound = true;

          } else {
            console.warn(`⚠️ [Market Detail API] outcomePrices 存在但验证失败:`, {
              yesPrice,
              noPrice,
              yesPriceValid: yesPrice !== null && !isNaN(yesPrice) && yesPrice >= 0 && yesPrice <= 1,
            });
          }
        } else {
          console.warn(`⚠️ [Market Detail API] outcomePrices 为空或不存在`);
        }
      } catch (e) {
        console.warn(`⚠️ [Market Detail API] 解析 outcomePrices 失败:`, e);
      }
      
      // 第二优先级：使用 initialPrice（如果有且 > 0，说明已经从 Polymarket 同步过）
      if (!syncedOddsFound) {
        const initialPrice = (marketData as any).initialPrice;
        if (typeof initialPrice === 'number' && !isNaN(initialPrice) && initialPrice > 0 && initialPrice <= 1) {
          yesPercent = initialPrice * 100;
          noPercent = (1 - initialPrice) * 100;
          syncedOddsFound = true;

        }
      }
      
      // 🔥 如果 Polymarket 尚未开启下一期（提前生成），暂时显示 50/50，直到 Polymarket 开启后立即同步
      if (!syncedOddsFound) {
        if (isFactoryMarket) {
          if (hasExternalId) {

          } else {

          }
        } else {
          console.warn(`⚠️ [Market Detail API] POLYMARKET市场 ${marketData.id} 未找到同步赔率，使用默认 50/50`);
        }
      }
    } else {
      // 🏠 纯自建市场（无 externalId）：使用本地成交计算
      const totalAmount = marketData.totalYes + marketData.totalNo;
      if (totalAmount > 0) {
        yesPercent = (marketData.totalYes / totalAmount) * 100;
        noPercent = (marketData.totalNo / totalAmount) * 100;

      } else {

        // 🔥 确保使用默认值50/50，而不是0/100
        yesPercent = 50;
        noPercent = 50;
      }
    }
    
    // 🔥 移除安全检查：允许显示真实的Polymarket赔率，包括0/100（已结算市场）
    // 不再强制使用50/50，确保实时同步Polymarket的真实赔率数据

    // 🔥 工厂市场导航：查询同一 templateId 今天的所有市场，按时间排序
    let slots: Array<{ id: string; startTime: string; endTime: string; status: string }> = [];
    
    if (formattedMarket.templateId) {
      try {

        // 计算今天的开始和结束时间（UTC+8，Asia/Shanghai）
        const now = new Date();
        // 获取 UTC+8 时区的当前日期字符串（YYYY-MM-DD）
        const shanghaiDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }); // 'en-CA' 格式为 YYYY-MM-DD
        
        // 创建 UTC+8 时区的今天开始时间（00:00:00）
        const todayStartUTC = new Date(`${shanghaiDateStr}T00:00:00+08:00`);
        
        // 创建 UTC+8 时区的今天结束时间（23:59:59）
        const todayEndUTC = new Date(`${shanghaiDateStr}T23:59:59.999+08:00`);
        
        // 查询同一 templateId 且 closingDate 在今天的所有市场
        // 使用 closingDate 而不是 createdAt，因为 closingDate 是市场的实际结束时间
        const sameTemplateMarkets = await prisma.markets.findMany({
          where: {
            templateId: formattedMarket.templateId,
            isFactory: true,
            isActive: true,
            reviewStatus: 'PUBLISHED',
            closingDate: {
              gte: todayStartUTC,
              lte: todayEndUTC,
            },
          },
          select: {
            id: true,
            title: true, // 🔥 添加title用于调试和过滤
            symbol: true, // 🔥 添加symbol用于过滤
            createdAt: true,
            closingDate: true,
            status: true,
            period: true, // 🔥 需要 period 来计算 startTime
          },
          orderBy: {
            createdAt: 'asc', // 按创建时间（开始时间）排序
          },
        });

        // 🔥 关键修复：必须同时使用templateId和symbol过滤，确保不混入其他市场
        const currentMarketSymbol = (market as any).symbol;
        const currentMarketTitle = market.title;
        
        // 🔥 必须同时匹配templateId、symbol和title，确保不混入手动市场或其他类型的市场
        let filteredMarkets = sameTemplateMarkets.filter((m) => {
          const marketSymbol = (m as any).symbol;
          const marketTitle = (m as any).title;
          
          // 如果当前市场有symbol，必须匹配symbol
          if (currentMarketSymbol) {
            if (marketSymbol !== currentMarketSymbol) {
              return false;
            }
          }
          
          // 同时必须匹配title（防止不同symbol但有相同templateId的情况）
          if (marketTitle !== currentMarketTitle) {
            return false;
          }
          
          return true;
        });
        
        if (filteredMarkets.length !== sameTemplateMarkets.length) {

        }
        
        // 使用过滤后的市场列表
        sameTemplateMarkets.length = 0;
        sameTemplateMarkets.push(...filteredMarkets);
        
        // 转换为 slots 格式
        slots = sameTemplateMarkets.map((m) => {
          // 🔥 计算场次开始时间：startTime = closingDate - period（分钟）
          const period = (m as any).period || 15; // 默认15分钟
          const endTime = m.closingDate;
          const startTime = new Date(endTime.getTime() - period * 60 * 1000);
          const nowTime = new Date();
          
          let status: 'ended' | 'active' | 'upcoming';
          if (endTime <= nowTime) {
            status = 'ended';
          } else if (startTime <= nowTime && endTime > nowTime) {
            status = 'active';
          } else {
            status = 'upcoming';
          }
          
          return {
            id: m.id,
            startTime: startTime.toISOString(), // 🔥 使用计算出的 startTime（场次开始时间）
            endTime: endTime.toISOString(),
            status,
          };
        });
        
        // 🔥 按 startTime 物理升序排列（确保导航栏从早到晚整齐排列）
        slots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      } catch (error) {
        console.error('❌ [Market Detail API] 查询 slots 失败:', error);
        slots = [];
      }
    }

    // 🔥 调试日志：在构建 serializedMarket 之前，确认 yesPercent 和 noPercent 的值

    // 响应数据完整性：确保 API 返回的市场对象中，所有字段都是完整的
    // 将数据库格式转换为前端期望的格式（使用 formattedMarket）
    const serializedMarket = {
      // 基础字段
      id: formattedMarket.id,
      title: formattedMarket.title,
      description: formattedMarket.description || '',
      
      // 日期字段（确保是字符串格式）
      endTime: formattedMarket.closingDate,
      closingDate: formattedMarket.closingDate,
      createdAt: formattedMarket.createdAt,
      updatedAt: market.updatedAt ? market.updatedAt.toISOString() : formattedMarket.createdAt, // 🔥 修复：使用实际的 updatedAt，如果没有则使用 createdAt
      
      // 状态和结果
      status: formattedMarket.status,
      winningOutcome: formattedMarket.resolvedOutcome || null,
      
      // 交易量和百分比（前端期望的格式）
      // 🔥 使用新的展示交易量计算逻辑
      displayVolume: calculateDisplayVolume({
        source: formattedMarket.source || 'INTERNAL',
        externalVolume: formattedMarket.externalVolume ?? 0,
        internalVolume: formattedMarket.internalVolume ?? 0,
        manualOffset: formattedMarket.manualOffset ?? 0,
      }),
      volume: calculateDisplayVolume({
        source: formattedMarket.source || 'INTERNAL',
        externalVolume: formattedMarket.externalVolume ?? 0,
        internalVolume: formattedMarket.internalVolume ?? 0,
        manualOffset: formattedMarket.manualOffset ?? 0,
      }), // 兼容字段，使用 displayVolume
      totalVolume: calculateDisplayVolume({
        source: formattedMarket.source || 'INTERNAL',
        externalVolume: formattedMarket.externalVolume ?? 0,
        internalVolume: formattedMarket.internalVolume ?? 0,
        manualOffset: formattedMarket.manualOffset ?? 0,
      }), // 兼容字段，使用 displayVolume
      totalYes: formattedMarket.totalYes || 0,
      totalNo: formattedMarket.totalNo || 0,
      yesPercent: Math.round(yesPercent), // 🔥 修复：yesPercent已经是百分比（0-100），直接四舍五入到整数
      noPercent: Math.round(noPercent),   // 🔥 修复：noPercent已经是百分比（0-100），直接四舍五入到整数
      
      // 新增字段：展示来源和详细交易量信息
      source: formattedMarket.source || 'INTERNAL',
      externalVolume: formattedMarket.externalVolume ?? 0,
      internalVolume: formattedMarket.internalVolume ?? 0,
      manualOffset: formattedMarket.manualOffset ?? 0,
      
      // 分类字段
      category: formattedMarket.category || '',
      categorySlug: formattedMarket.categorySlug || '',
      
      // 🔥 添加中文翻译字段
      titleZh: (formattedMarket as any).titleZh || null,
      descriptionZh: (formattedMarket as any).descriptionZh || null,
      
      // 用户订单列表（修复详情页订单列表）
      userOrders: userOrders || [],
      userPosition: userPosition || null,
      
      // 其他字段
      feeRate: formattedMarket.feeRate || 0.05,
      // 🔥 添加原始数据字段（从数据库直接读取）
      outcomePrices: (formattedMarket as any).outcomePrices || null,
      image: (formattedMarket as any).image || null,
      iconUrl: (formattedMarket as any).iconUrl || null,
      initialPrice: (formattedMarket as any).initialPrice || null,
      volume24h: (formattedMarket as any).volume24h || null,
      // 🔥 工厂市场字段（用于时间区间显示和导航）- 使用formattedMarket中的数据
      isFactory: formattedMarket.isFactory || false,
      // 🔥 修复：使用formattedMarket中的period（已经包含了从templateData获取的逻辑）
      period: formattedMarket.period || null,
      strikePrice: formattedMarket.strikePrice || null,
      templateId: formattedMarket.templateId || null, // 🔥 用于查找下一期市场
      factoryId: null, // 🔥 临时移除：数据库中没有factoryId字段
      template: formattedMarket.template || null, // 🔥 传递手动查询的 template 对象
      externalId: (formattedMarket as any).externalId || null, // 🔥 用于检查是否有同步赔率
      slots: slots, // 🔥 同模板今天的所有市场，用于时间导航栏
      // 🔥 图标字段：优先根据 symbol/title 判断（因为数据库图片可能还未修复），然后才检查数据库图片
      icon: (() => {
        // 🔥 关键修复：优先根据 symbol/title 判断（因为数据库图片可能还是错误的）
        const symbol = (formattedMarket as any).symbol || '';
        const title = formattedMarket.title || '';
        const symbolUpper = symbol.toUpperCase();
        const titleUpper = title.toUpperCase();
        
        // 优先判断 ETH（因为标题可能包含 "ETH涨跌"）
        if (symbolUpper.includes('ETH') || titleUpper.includes('ETH') || titleUpper.includes('以太坊') || titleUpper.includes('ETHEREUM')) {
          return 'Ethereum';
        }
        if (symbolUpper.includes('BTC') || titleUpper.includes('BTC') || titleUpper.includes('比特币') || titleUpper.includes('BITCOIN')) {
          return 'Bitcoin';
        }
        
        // 如果 symbol/title 无法判断，才检查数据库图片（作为后备方案）
        const dbImage = (formattedMarket as any).image || (formattedMarket as any).iconUrl || '';
        const dbImageLower = dbImage.toLowerCase();
        if (dbImage && (dbImageLower.includes('ethereum') || dbImageLower.includes('eth'))) {
          return 'Ethereum';
        }
        if (dbImage && (dbImageLower.includes('bitcoin') || dbImageLower.includes('btc'))) {
          return 'Bitcoin';
        }
        
        // 🔥 修复：不默认返回Bitcoin，返回null让前端根据分类判断
        return null;
      })(),
      iconColor: (() => {
        // 🔥 关键修复：优先根据 symbol/title 判断（因为数据库图片可能还是错误的）
        const symbol = (formattedMarket as any).symbol || '';
        const title = formattedMarket.title || '';
        const symbolUpper = symbol.toUpperCase();
        const titleUpper = title.toUpperCase();
        
        // 优先判断 ETH（因为标题可能包含 "ETH涨跌"）
        if (symbolUpper.includes('ETH') || titleUpper.includes('ETH') || titleUpper.includes('以太坊') || titleUpper.includes('ETHEREUM')) {
          return 'bg-[#627EEA]'; // 以太坊蓝色
        }
        if (symbolUpper.includes('BTC') || titleUpper.includes('BTC') || titleUpper.includes('比特币') || titleUpper.includes('BITCOIN')) {
          return 'bg-[#f7931a]'; // 比特币橙色
        }
        
        // 如果 symbol/title 无法判断，才检查数据库图片（作为后备方案）
        const dbImage = (formattedMarket as any).image || (formattedMarket as any).iconUrl || '';
        const dbImageLower = dbImage.toLowerCase();
        if (dbImage && (dbImageLower.includes('ethereum') || dbImageLower.includes('eth'))) {
          return 'bg-[#627EEA]'; // 以太坊蓝色
        }
        if (dbImage && (dbImageLower.includes('bitcoin') || dbImageLower.includes('btc'))) {
          return 'bg-[#f7931a]'; // 比特币橙色
        }
        
        // 🔥 修复：不默认返回Bitcoin颜色，返回null让前端根据分类判断
        return null;
      })(),
      // 兼容字段：确保 imageUrl 也正确设置（优先使用数据库中的图片）
      imageUrl: (() => {
        const dbImage = (formattedMarket as any).image || (formattedMarket as any).iconUrl || '';
        // 如果数据库中有图片且是正确的 ETH 图片，直接使用
        if (dbImage && (dbImage.includes('ethereum') || dbImage.includes('eth'))) {
          return dbImage;
        }
        // 如果是 BTC 图片，直接使用
        if (dbImage && (dbImage.includes('bitcoin') || dbImage.includes('btc'))) {
          return dbImage;
        }
        // 如果没有数据库图片，根据 symbol 返回对应的默认图片 URL
        const symbol = (formattedMarket as any).symbol || '';
        const symbolUpper = symbol.toUpperCase();
        if (symbolUpper.includes('ETH')) {
          return 'https://cryptologos.cc/logos/ethereum-eth-logo.png';
        }
        if (symbolUpper.includes('BTC')) {
          return 'https://cryptologos.cc/logos/bitcoin-btc-logo.png';
        }
        return dbImage; // 返回数据库图片（可能为空）
      })(),
      commentsCount: 0, // 默认 0（如果数据库中没有此字段）
      sourceUrl: undefined,
      resolutionCriteria: undefined,
    };

    // 强制校验：确保 DBService.findMarketById 成功返回数据
    if (!market) {
      console.error('❌ [Market Detail API] 强制校验失败：市场数据为空');
      return createNoCacheResponse(
        {
          success: false,
          error: 'Market not found',
        },
        404
      );
    }
    
    // 数据完整性强制校验：确保所有关键字段都有值
    const criticalFields = {
      title: serializedMarket.title,
      description: serializedMarket.description,
      endTime: serializedMarket.endTime,
      volume: serializedMarket.volume,
      yesPercent: serializedMarket.yesPercent,
      noPercent: serializedMarket.noPercent,
      status: serializedMarket.status,
    };
    
    // 🔥 修复：description 字段允许为空字符串，不作为缺失字段
    const missingCriticalFields = Object.entries(criticalFields)
      .filter(([key, value]) => {
        // description 字段允许为空字符串，不作为缺失字段
        if (key === 'description') {
          return value === undefined || value === null;
        }
        return value === undefined || value === null || value === '';
      })
      .map(([key]) => key);
    
    if (missingCriticalFields.length > 0) {
      console.error('❌ [Market Detail API] 强制校验失败：缺少关键字段:', missingCriticalFields);
      // 为缺失的字段设置默认值
      if (!serializedMarket.title) serializedMarket.title = '未知市场';
      if (serializedMarket.description === undefined || serializedMarket.description === null) {
        serializedMarket.description = '';
      }
      if (!serializedMarket.endTime) serializedMarket.endTime = new Date().toISOString();
      if (serializedMarket.volume === undefined) serializedMarket.volume = 0;
      if (serializedMarket.yesPercent === undefined) serializedMarket.yesPercent = 50;
      if (serializedMarket.noPercent === undefined) serializedMarket.noPercent = 50;
      if (!serializedMarket.status) serializedMarket.status = 'OPEN' as any;
    }

    // 后端调试：在服务器终端打印 API 返回给前端的完整市场详情 JSON 字符串
    const finalResponse = {
      success: true,
      data: serializedMarket,
    };

    // 🔥 关键修复：使用 createNoCacheResponse 防止浏览器缓存，确保赔率数据实时更新
    return createNoCacheResponse(finalResponse);
  } catch (error) {
    // 捕获异常：打印完整的错误堆栈
    console.error('❌ [Market Detail API] ========== 获取市场详情失败 ==========');
    console.error('❌ [Market Detail API] 错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('❌ [Market Detail API] 错误消息:', error instanceof Error ? error.message : String(error));
    console.error('❌ [Market Detail API] 完整错误堆栈:');
    if (error instanceof Error) {
      console.error(error.stack);
    } else {
      console.error(error);
    }
    console.error('❌ [Market Detail API] ===============================');

    return createNoCacheResponse(
      {
        success: false,
        error: 'Failed to fetch market',
        // 开发环境下返回详细错误信息（生产环境应移除）
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? { details: error.message, stack: error.stack }
          : {}),
      },
      500
    );
  }
}

