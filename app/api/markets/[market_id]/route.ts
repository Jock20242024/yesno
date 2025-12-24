import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DBService } from '@/lib/dbService';
import { extractUserIdFromToken } from '@/lib/authUtils'; // 强制数据隔离：使用统一的 userId 提取函数
import { prisma } from '@/lib/prisma';
import { calculateDisplayVolume } from '@/lib/marketUtils';

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
    console.log('📊 [Market Detail API] ========== 开始处理获取市场详情请求 ==========');
    
    const { market_id } = await params;
    
    // 打印 Slug：确保 API 能够正确获取并打印 URL 中的市场标识符
    console.log('🔍 [Market Detail API] 接收到的市场ID:', {
      market_id,
      market_idType: typeof market_id,
      market_idLength: market_id?.length,
    });

    if (!market_id || market_id.trim() === '') {
      console.error('❌ [Market Detail API] 市场ID为空');
      return NextResponse.json(
        {
          success: false,
          error: 'Market ID is required',
        },
        { status: 400 }
      );
    }

    // 🔥 P0修复：先不使用include marketTemplate，直接查询Market表（字段在schema中已定义）
    // 如果关联有问题，后续可以手动查询template
    const market = await prisma.market.findUnique({
      where: { id: market_id },
      include: {
        categories: {
          include: {
            category: {
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
      return NextResponse.json({ success: false, error: 'Market not found' }, { status: 404 });
    }

    // 检查市场是否已发布且激活
    if (market.reviewStatus !== 'PUBLISHED' || !market.isActive) {
      console.error('❌ [Market Detail API] 市场未发布或未激活:', market_id);
      return NextResponse.json({ success: false, error: 'Market not available' }, { status: 404 });
    }
    
    // 2. 组装返回数据
    const categories = market.categories || [];
    
    // 🔥 P0修复：手动查询marketTemplate（如果templateId存在）
    let marketTemplate = null;
    if ((market as any).templateId) {
      try {
        marketTemplate = await prisma.marketTemplate.findUnique({
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
      description: market.description,
      closingDate: market.closingDate.toISOString(),
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
          
          const yesPosition = await prisma.position.findFirst({
            where: {
              userId,
              marketId: market_id,
              outcome: 'YES',
              status: 'OPEN', // ========== 强制规则：只查询OPEN状态的持仓 ==========
            },
          });
          
          const noPosition = await prisma.position.findFirst({
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
          
          console.log('📊 [Market Detail API] 用户持仓（从Position表）:', {
            userId,
            marketId: market_id,
            userPosition,
            orderCount: userOrders.length,
          });
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
          
          // 验证价格有效性
          if (yesPrice !== null && !isNaN(yesPrice) && yesPrice >= 0 && yesPrice <= 1) {
            yesPercent = yesPrice * 100;
            // 如果对象格式有明确的 NO 价格，使用它；否则计算
            if (noPrice !== null && !isNaN(noPrice) && noPrice >= 0 && noPrice <= 1) {
              noPercent = noPrice * 100;
            } else {
              noPercent = (1 - yesPrice) * 100;
            }
            syncedOddsFound = true;
            console.log(`✅ [Market Detail API] 强制使用同步赔率: YES=${yesPercent.toFixed(2)}%, NO=${noPercent.toFixed(2)}% (来源: outcomePrices, externalId: ${(marketData as any).externalId || '未设置'})`);
          }
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
          console.log(`✅ [Market Detail API] 强制使用同步赔率: YES=${yesPercent.toFixed(2)}%, NO=${noPercent.toFixed(2)}% (来源: initialPrice, externalId: ${(marketData as any).externalId || '未设置'})`);
        }
      }
      
      // 🔥 如果 Polymarket 尚未开启下一期（提前生成），暂时显示 50/50，直到 Polymarket 开启后立即同步
      if (!syncedOddsFound) {
        if (isFactoryMarket) {
          if (hasExternalId) {
            console.log(`ℹ️ [Market Detail API] 工厂市场 ${marketData.id} 有 externalId (${(marketData as any).externalId})，但尚未同步到赔率数据，暂时显示 50/50（等待赔率机器人同步）`);
          } else {
            console.log(`ℹ️ [Market Detail API] 工厂市场 ${marketData.id} 暂未匹配 externalId，等待自动绑定和同步（暂时显示 50/50）`);
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
        console.log(`ℹ️ [Market Detail API] 使用本地成交计算赔率（自建市场）: YES=${yesPercent.toFixed(2)}%, NO=${noPercent.toFixed(2)}%`);
      } else {
        console.log(`ℹ️ [Market Detail API] 自建市场 ${marketData.id} 无交易数据，使用默认 50/50 赔率`);
      }
    }

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
        const sameTemplateMarkets = await prisma.market.findMany({
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
            createdAt: true,
            closingDate: true,
            status: true,
            period: true, // 🔥 需要 period 来计算 startTime
          },
          orderBy: {
            createdAt: 'asc', // 按创建时间（开始时间）排序
          },
        });
        
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
        
        console.log(`📊 [Market Detail API] 查询到 ${slots.length} 个同模板市场（今天）`);
      } catch (error) {
        console.error('❌ [Market Detail API] 查询 slots 失败:', error);
        slots = [];
      }
    }

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
      updatedAt: formattedMarket.createdAt,
      
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
      yesPercent: Math.round(yesPercent * 100) / 100, // 保留两位小数
      noPercent: Math.round(noPercent * 100) / 100, // 保留两位小数
      
      // 新增字段：展示来源和详细交易量信息
      source: formattedMarket.source || 'INTERNAL',
      externalVolume: formattedMarket.externalVolume ?? 0,
      internalVolume: formattedMarket.internalVolume ?? 0,
      manualOffset: formattedMarket.manualOffset ?? 0,
      
      // 分类字段
      category: formattedMarket.category || '',
      categorySlug: formattedMarket.categorySlug || '',
      
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
      // 兼容字段
      imageUrl: (formattedMarket as any).image || (formattedMarket as any).iconUrl || '', // 使用数据库图片URL
      commentsCount: 0, // 默认 0（如果数据库中没有此字段）
      sourceUrl: undefined,
      resolutionCriteria: undefined,
    };

    // 强制校验：确保 DBService.findMarketById 成功返回数据
    if (!market) {
      console.error('❌ [Market Detail API] 强制校验失败：市场数据为空');
      return NextResponse.json(
        {
          success: false,
          error: 'Market not found',
        },
        { status: 404 }
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
    
    const missingCriticalFields = Object.entries(criticalFields)
      .filter(([key, value]) => value === undefined || value === null || value === '')
      .map(([key]) => key);
    
    if (missingCriticalFields.length > 0) {
      console.error('❌ [Market Detail API] 强制校验失败：缺少关键字段:', missingCriticalFields);
      // 为缺失的字段设置默认值
      if (!serializedMarket.title) serializedMarket.title = '未知市场';
      if (!serializedMarket.description) serializedMarket.description = '';
      if (!serializedMarket.endTime) serializedMarket.endTime = new Date().toISOString();
      if (serializedMarket.volume === undefined) serializedMarket.volume = 0;
      if (serializedMarket.yesPercent === undefined) serializedMarket.yesPercent = 50;
      if (serializedMarket.noPercent === undefined) serializedMarket.noPercent = 50;
      if (!serializedMarket.status) serializedMarket.status = 'OPEN' as any;
    }

    console.log('✅ [Market Detail API] ========== 市场详情获取成功 ==========');
    console.log('✅ [Market Detail API] 市场ID:', market.id);
    console.log('✅ [Market Detail API] 市场标题:', serializedMarket.title);
    console.log('✅ [Market Detail API] 市场描述:', serializedMarket.description ? `${serializedMarket.description.substring(0, 50)}...` : '空');
    console.log('✅ [Market Detail API] 市场状态:', serializedMarket.status);
    console.log('✅ [Market Detail API] 交易量 (volume):', serializedMarket.volume);
    console.log('✅ [Market Detail API] YES百分比:', serializedMarket.yesPercent);
    console.log('✅ [Market Detail API] NO百分比:', serializedMarket.noPercent);
    console.log('✅ [Market Detail API] 截止日期 (endTime):', serializedMarket.endTime);
    console.log('✅ [Market Detail API] 总交易量 (totalVolume):', serializedMarket.totalVolume);
    console.log('✅ [Market Detail API] YES总金额 (totalYes):', serializedMarket.totalYes);
    console.log('✅ [Market Detail API] NO总金额 (totalNo):', serializedMarket.totalNo);
    
    // 后端调试：在服务器终端打印 API 返回给前端的完整市场详情 JSON 字符串
    const finalResponse = {
      success: true,
      data: serializedMarket,
    };
    
    console.log('📤 [Market Detail API] ========== 最终返回的完整 JSON 字符串 ==========');
    console.log(JSON.stringify(finalResponse, null, 2));
    console.log('📤 [Market Detail API] 关键字段检查:');
    console.log('📤 [Market Detail API]   - title:', serializedMarket.title ? '✅' : '❌');
    console.log('📤 [Market Detail API]   - description:', serializedMarket.description ? '✅' : '❌');
    console.log('📤 [Market Detail API]   - endTime:', serializedMarket.endTime ? '✅' : '❌');
    console.log('📤 [Market Detail API]   - volume:', serializedMarket.volume !== undefined ? `✅ (${serializedMarket.volume})` : '❌');
    console.log('📤 [Market Detail API]   - yesPercent:', serializedMarket.yesPercent !== undefined ? `✅ (${serializedMarket.yesPercent}%)` : '❌');
    console.log('📤 [Market Detail API]   - noPercent:', serializedMarket.noPercent !== undefined ? `✅ (${serializedMarket.noPercent}%)` : '❌');
    console.log('📤 [Market Detail API]   - status:', serializedMarket.status ? `✅ (${serializedMarket.status})` : '❌');
    console.log('📤 [Market Detail API]   - totalVolume:', serializedMarket.totalVolume !== undefined ? `✅ (${serializedMarket.totalVolume})` : '❌');
    console.log('📤 [Market Detail API]   - totalYes:', serializedMarket.totalYes !== undefined ? `✅ (${serializedMarket.totalYes})` : '❌');
    console.log('📤 [Market Detail API]   - totalNo:', serializedMarket.totalNo !== undefined ? `✅ (${serializedMarket.totalNo})` : '❌');
    console.log('📤 [Market Detail API] ============================================');

    return NextResponse.json(finalResponse);
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

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch market',
        // 开发环境下返回详细错误信息（生产环境应移除）
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? { details: error.message, stack: error.stack }
          : {}),
      },
      { status: 500 }
    );
  }
}

