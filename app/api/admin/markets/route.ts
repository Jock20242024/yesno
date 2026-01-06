import { NextRequest, NextResponse } from 'next/server';
import { DBService } from '@/lib/dbService'; // 🔥 修复：使用正确的 dbService 而不是 mockData
import { Market, MarketStatus, Outcome } from '@/types/data';
import { prisma } from '@/lib/prisma';
import { auth } from "@/lib/authExport";
import { aggregateMarketsByTemplate, countUniqueMarketSeries } from '@/lib/marketAggregation';
import dayjs from '@/lib/dayjs';

// 🔥 强制清理前端缓存：确保不使用旧缓存
export const dynamic = 'force-dynamic';

/**
 * 管理后台 - 获取市场列表 API
 * GET /api/admin/markets
 * 
 * 查询参数：
 * - search?: string      // 搜索关键词（市场ID或标题）
 * - status?: string       // 状态筛选（open, closed, pending, resolved）
 * - page?: number         // 页码（默认 1）
 * - limit?: number        // 每页数量（默认 10）
 */
export async function GET(request: NextRequest) {
  try {

    // 权限校验：使用 NextAuth session 验证管理员身份
    const session = await auth();
    
    // 🔥 修复 500 错误：确保 session 和 user 不为 null
    if (!session || !session.user) {
      console.error('❌ [Admin Markets GET] Session 验证失败: session 或 user 为空');
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }
    
    // 🔥 双重校验：角色为 ADMIN 或邮箱为管理员邮箱
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com'; // 管理员邮箱
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      console.error('❌ [Admin Markets GET] 权限验证失败:', { userRole, userEmail });
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const statusFilter = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    // 🚀 修复：使用 source 参数过滤（基于 isFactory 布尔值，而非 templateId 字符串）
    const source = searchParams.get('source') || '';

    // 🔥 市场管理：按 templateId 聚合，显示市场系列而非单个场次
    // 1. 查询所有已发布的市场（排除 PENDING_REVIEW）
    // 2. 过滤掉已结算超过24小时的历史记录
    // 3. 按 templateId 分组聚合
    // 🔥 检查是否显示详细场次（下钻功能）
    const showDetails = searchParams.get('showDetails') === 'true';
    
    let filteredMarkets: any[] = [];
    try {
      const now = dayjs.utc();
      const fortyEightHoursAgo = now.subtract(48, 'hour');
      
      // 🔥 自动清理机制：逻辑上忽略结束时间超过 48 小时且已结算的市场
      // 但在聚合统计中仍然需要这些数据来计算"历史"数量，所以先查询所有数据
      // 🚀 修复：根据 source 参数添加 isFactory 过滤条件（基于布尔值，而非字符串匹配）
      const whereCondition: any = {
          isActive: true,
          status: {
            not: 'PENDING_REVIEW', // 🔥 排除所有 PENDING_REVIEW 状态的市场
          },
          reviewStatus: 'PUBLISHED', // 🔥 修复：只显示已发布的市场（reviewStatus 为 PUBLISHED）
      };
      
      // 🚀 修复：根据 source 参数过滤（使用 isFactory 布尔值作为唯一真理标准）
      if (source === 'factory') {
        // ✅ 工厂市场：只有真正的工厂产品才显示（isFactory = true）
        whereCondition.isFactory = true;
      } else if (source === 'manual') {
        // ✅ 手动市场：只要不是工厂的，统统算手动（isFactory = false）
        // 注意：isFactory 字段是 Boolean @default(false)，不会有 null 值
        whereCondition.isFactory = false;
      }
      // 如果 source 为空或未传，保持原样（查全部），不加 isFactory 限制
      
      // 🧹 维护任务：自动将已过期但仍为OPEN的工厂市场更新为CLOSED（每次查询时执行）
      // 这样可以确保前端显示的数据实时反映最新的状态
      const nowUtcForMaintenance = dayjs.utc();
      const nowUtcDateForMaintenance = nowUtcForMaintenance.toDate();
      try {
        const updateResult = await prisma.markets.updateMany({
          where: {
            status: 'OPEN',
            closingDate: { lt: nowUtcDateForMaintenance },
            isFactory: true,
          },
          data: {
            status: 'CLOSED',
          },
        });
        if (updateResult.count > 0) {

        }
      } catch (maintenanceError: any) {
        console.error(`⚠️ [Admin Markets GET] 维护任务失败: ${maintenanceError.message}，继续执行查询`);
      }
      
      const dbMarketsAll = await prisma.markets.findMany({
        where: whereCondition,
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      // 🔥 分离需要显示的市场
      // 🚀 修复：工厂市场不应该被48小时过滤规则影响（36小时窗口需要显示所有场次）
      const dbMarkets = dbMarketsAll.filter(m => {
        const isFactoryMarket = (m as any).isFactory === true;
        
        // 工厂市场：不过滤，显示所有场次（36小时窗口内的所有场次都需要显示）
        if (isFactoryMarket) {
          return true;
        }
        
        // 手动市场：排除超过 48 小时的已结算市场
        if (m.status === 'RESOLVED') {
          const closingDate = dayjs.utc(m.closingDate);
          return closingDate.isAfter(fortyEightHoursAgo);
        }
        return true; // 其他状态的市场都显示
      });
      
      // 转换为 Market 类型格式（保持与原有格式一致，包含所有必要字段）
        const convertToNumber = (value: any): number => {
          if (value === null || value === undefined) return 0;
          if (typeof value === 'bigint') {
            try {
              return Number(value);
            } catch {
              return 0;
            }
          }
          if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? 0 : parsed;
          }
          const num = Number(value);
          return isNaN(num) || !isFinite(num) ? 0 : num;
        };
        
      // 🚀 计算交易统计数据（交易用户数/交易人次）
      // 批量查询所有市场的订单统计（优化性能）
      const marketIds = dbMarkets.map(m => m.id);
      
      // 🔥 修复：使用兼容的方式查询订单统计，并处理空数组情况
      let orderStatsMap = new Map<string, { userCount: number; orderCount: number }>();
      
      if (marketIds.length > 0) {
        // 🚀 判断是否为工厂市场：检查第一个市场的isFactory字段
        // 注意：这里假设同一批次查询的市场都是同一类型（工厂或手动）
        const isFactoryBatch = dbMarkets.length > 0 && (dbMarkets[0] as any).isFactory === true;
        
        // 🚀 工厂市场：24小时滚动统计；手动市场：全量统计
        const orderWhereCondition: any = {
          marketId: { in: marketIds },
        };
        
        if (isFactoryBatch) {
          // 工厂市场：只统计最近24小时内的订单
          const twentyFourHoursAgo = dayjs.utc().subtract(24, 'hour').toDate();
          orderWhereCondition.createdAt = {
            gte: twentyFourHoursAgo,
          };
        }
        // 手动市场：不添加时间限制，统计所有订单
        
        // 1. 查询每个市场的订单数
        const orderCounts = await prisma.orders.groupBy({
          by: ['marketId'],
          where: orderWhereCondition,
          _count: {
            id: true, // 交易人次（总订单数）
          },
        });
        
        // 2. 查询所有订单的用户ID（手动去重）
        const allOrders = await prisma.orders.findMany({
          where: orderWhereCondition,
          select: {
            marketId: true,
            userId: true,
          },
        });
        
        // 3. 构建订单数映射
        const orderCountMap = new Map(
          orderCounts.map(stat => [stat.marketId, stat._count.id || 0])
        );
        
        // 4. 构建用户数映射（按市场ID分组，手动去重用户ID）
        const userCountMap = new Map<string, Set<string>>();
        allOrders.forEach(order => {
          if (!userCountMap.has(order.marketId)) {
            userCountMap.set(order.marketId, new Set());
          }
          userCountMap.get(order.marketId)!.add(order.userId);
        });
        
        // 5. 转换为数量映射
        const userCountMapFinal = new Map<string, number>();
        userCountMap.forEach((userSet, marketId) => {
          userCountMapFinal.set(marketId, userSet.size);
        });
        
        // 6. 转换为统一的 Map 格式
        orderStatsMap = new Map(
          marketIds.map(marketId => [
            marketId,
            {
              userCount: userCountMapFinal.get(marketId) || 0, // 交易用户数
              orderCount: orderCountMap.get(marketId) || 0, // 交易人次
            }
          ])
        );
        
        // 🚀 调试日志：打印前几个市场的统计结果

        const sampleStats = Array.from(orderStatsMap.entries()).slice(0, 5);
        sampleStats.forEach(([marketId, stats]) => {

        });
      }
      
      // 🚀 辅助函数：构建市场详情对象（用于子市场列表）
      const buildMarketDetail = (dbMarket: any) => {
        return {
          id: dbMarket.id,
          endTime: dbMarket.closingDate.toISOString(),
          period: (dbMarket as any).period || null,
          externalId: (dbMarket as any).externalId || null,
          outcomePrices: (dbMarket as any).outcomePrices || null,
        };
      };
      
      // 🔥 同时处理所有市场（用于统计历史数量）和过滤后的市场（用于显示）
      const allMarkets = dbMarkets.map((dbMarket) => {
        const stats = orderStatsMap.get(dbMarket.id) || { userCount: 0, orderCount: 0 };
        // 🚀 修复：总交易量只使用本地平台的真实数据（internalVolume），不包含外部爬取的数据
        const localVolume = convertToNumber(dbMarket.internalVolume || 0);
        return {
          id: dbMarket.id,
          title: dbMarket.title,
          volume: localVolume, // 🚀 修复：使用本地交易量
          totalVolume: localVolume, // 🚀 修复：使用本地交易量
          totalYes: convertToNumber(dbMarket.totalYes || 0),
          totalNo: convertToNumber(dbMarket.totalNo || 0),
          status: dbMarket.status as any,
          endTime: dbMarket.closingDate.toISOString(),
          yesPercent: dbMarket.yesProbability || 50,
          feeRate: convertToNumber(dbMarket.feeRate || 0.05),
          isHot: dbMarket.isHot || false,
          externalVolume: convertToNumber(dbMarket.externalVolume || 0),
          internalVolume: localVolume, // 🚀 本地交易量
          manualOffset: convertToNumber(dbMarket.manualOffset || 0),
          isActive: dbMarket.isActive !== false,
          templateId: (dbMarket as any).templateId || null,
          period: (dbMarket as any).period || null,
          isFactory: (dbMarket as any).isFactory || false,
          // 🚀 新增：交易统计数据（只统计本地平台的真实数据）
          tradingStats: {
            userCount: stats.userCount, // 交易用户数（本地平台）
            orderCount: stats.orderCount, // 交易人次（本地平台）
          },
        };
      });
      
      // 🚀 创建市场 ID 到市场详情的映射（用于快速查找）
      const marketDetailMap = new Map<string, any>();
      dbMarkets.forEach(dbMarket => {
        marketDetailMap.set(dbMarket.id, buildMarketDetail(dbMarket));
      });
      // 同时包含所有市场（用于历史记录）
      dbMarketsAll.forEach(dbMarket => {
        if (!marketDetailMap.has(dbMarket.id)) {
          marketDetailMap.set(dbMarket.id, buildMarketDetail(dbMarket));
        }
      });

      if (showDetails) {
        // 如果请求详细场次，直接返回所有市场（不聚合）
        filteredMarkets = allMarkets;
      } else {
        // 🔥 按 templateId 聚合：每一行代表一个市场系列
        // 🚀 修复：工厂市场的统计应该只统计36小时窗口内的市场（现在-12小时到现在+24小时）
        // 对于手动市场，使用全量数据
        const stats36HourWindowStart = now.subtract(12, 'hour').toDate();
        const stats36HourWindowEnd = now.add(24, 'hour').toDate();
        
        const allMarketsForStats = dbMarketsAll
          .filter((dbMarket) => {
            const isFactoryMarket = (dbMarket as any).isFactory === true;
            // 工厂市场：只统计36小时窗口内的
            if (isFactoryMarket) {
              const closingDate = dbMarket.closingDate;
              return closingDate >= stats36HourWindowStart && closingDate <= stats36HourWindowEnd;
            }
            // 手动市场：使用全量数据
            return true;
          })
          .map((dbMarket) => ({
            id: dbMarket.id,
            title: dbMarket.title,
            volume: convertToNumber(dbMarket.totalVolume || 0),
            totalVolume: convertToNumber(dbMarket.totalVolume || 0),
            status: dbMarket.status as any,
            endTime: dbMarket.closingDate.toISOString(),
            templateId: (dbMarket as any).templateId || null,
            isFactory: (dbMarket as any).isFactory || false, // 🚀 修复：必须包含 isFactory 字段，否则统计逻辑无法判断
          }));

        const aggregatedMap = new Map<string, any>();
        
        // 🚀 修复：先遍历 allMarkets 创建聚合记录（初始化工厂市场的基本信息，但不统计状态）
        // 然后遍历 allMarketsForStats 强制统计工厂市场的全量状态
        allMarkets.forEach((market) => {
          // 🔥 核心修复：重新定义"唯一性 Key"，确保独立市场不会互相覆盖
          // 必须确保聚合时，独立市场不会互相覆盖
          // 聚合键：如果有 templateId 使用 templateId，否则使用 `independent-${market.id}`
          const groupKey = market.templateId ? market.templateId : `independent-${market.id}`;
          
          if (!aggregatedMap.has(groupKey)) {
            // 创建新的聚合记录
            aggregatedMap.set(groupKey, {
              id: market.id, // 使用第一个市场的 ID 作为代表
              templateId: market.templateId || null,
              title: market.title,
              volume: 0,
              totalVolume: 0,
              totalYes: 0,
              totalNo: 0,
              status: market.status,
              endTime: market.endTime,
              yesPercent: market.yesPercent || 50,
              feeRate: market.feeRate || 0.05,
              isHot: market.isHot || false,
              isActive: market.isActive !== false,
              isFactory: market.isFactory || false, // 🚀 保存 isFactory 标记
              externalVolume: 0,
              internalVolume: 0,
              manualOffset: 0,
              // 🚀 新增：交易统计数据（将在聚合完成后统一计算）
              tradingStats: {
                userCount: 0, // 交易用户数（聚合后计算）
                orderCount: 0, // 交易人次（聚合后计算）
              },
              // 🔥 状态统计（包含历史统计）
              stats: {
                open: 0,      // 进行中
                pending: 0,   // 待结算 (PENDING, SETTLING, CLOSED)
                resolved: 0,  // 已结算（48小时内的）
                historical: 0, // 历史记录（超过 48 小时已结算的，不在列表中显示）
                total: 0,     // 总场次数（包含历史）
                totalActive: 0, // 活跃场次数（OPEN + PENDING）
                ended: 0,     // 🚀 工厂模式专用：已结束数量（RESOLVED + PENDING）
              },
              // 保存所有场次详情（用于下钻）- 🚀 改为对象数组
              marketIds: [] as any[],
              // 分离场次详情：用于默认显示和历史显示
              activeMarketIds: [] as any[], // OPEN 和 SETTLING/PENDING - 🚀 改为对象数组
              historicalMarketIds: [] as any[], // 超过 48 小时已结算的 - 🚀 改为对象数组
              // 🚀 临时存储：用于聚合时去重用户数
              _userIds: new Set<string>(), // 临时字段，聚合完成后删除
            });
          }
          
          const aggregated = aggregatedMap.get(groupKey)!;
          
          // 🚀 累加交易量（只累加本地平台的真实数据）
          aggregated.volume = (aggregated.volume || 0) + (market.volume || 0); // market.volume 已经是 internalVolume
          aggregated.totalVolume = (aggregated.totalVolume || 0) + (market.totalVolume || 0); // market.totalVolume 已经是 internalVolume
          aggregated.totalYes = (aggregated.totalYes || 0) + (market.totalYes || 0);
          
          // 🚀 交易统计数据将在聚合完成后统一计算（见下方循环）
          aggregated.totalNo = (aggregated.totalNo || 0) + (market.totalNo || 0);
          aggregated.externalVolume = (aggregated.externalVolume || 0) + (market.externalVolume || 0);
          aggregated.internalVolume = (aggregated.internalVolume || 0) + (market.internalVolume || 0);
          
          // 🚀 修复：对于工厂市场，不在这里统计状态（稍后在 allMarketsForStats 中全量统计）
          // 对于手动市场，正常统计状态
          if (market.isFactory !== true) {
            // 手动市场：正常统计状态
            aggregated.stats.total++;
            if (!aggregated.marketIds || !Array.isArray(aggregated.marketIds)) {
              aggregated.marketIds = [];
              aggregated.activeMarketIds = [];
              aggregated.historicalMarketIds = [];
            }
            // 🚀 推送市场详情对象而不是 ID
            const marketDetail = marketDetailMap.get(market.id);
            if (marketDetail) {
              aggregated.marketIds.push(marketDetail);
            }
            
            // 🔥 判断是否为历史记录（超过 48 小时且已结算）
            const isHistorical = market.status === 'RESOLVED' && 
              dayjs.utc(market.endTime).isBefore(now.subtract(48, 'hour'));
            
            // 更新状态统计和场次详情分类
            if (!aggregated.activeMarketIds || !Array.isArray(aggregated.activeMarketIds)) {
              aggregated.activeMarketIds = [];
            }
            if (!aggregated.historicalMarketIds || !Array.isArray(aggregated.historicalMarketIds)) {
              aggregated.historicalMarketIds = [];
            }
            
            if (market.status === 'OPEN') {
              aggregated.stats.open++;
              aggregated.stats.totalActive++;
              if (marketDetail) aggregated.activeMarketIds.push(marketDetail);
            } else if (market.status === 'PENDING' || market.status === 'SETTLING' || market.status === 'CLOSED') {
              aggregated.stats.pending++;
              if (marketDetail) aggregated.activeMarketIds.push(marketDetail);
            } else if (market.status === 'RESOLVED') {
              if (isHistorical) {
                aggregated.stats.historical++;
                if (marketDetail) aggregated.historicalMarketIds.push(marketDetail);
              } else {
                aggregated.stats.resolved++;
                if (marketDetail) aggregated.activeMarketIds.push(marketDetail);
              }
            }
          } else {
            // 工厂市场：只初始化，不统计状态（稍后全量统计）
            // 确保 marketIds 数组存在
            if (!aggregated.marketIds || !Array.isArray(aggregated.marketIds)) {
              aggregated.marketIds = [];
              aggregated.activeMarketIds = [];
              aggregated.historicalMarketIds = [];
            }
            // 注意：这里不统计，稍后在 allMarketsForStats 中统一全量统计
          }
          
          // 更新代表市场（选择最新的或最活跃的）
          const marketEndTime = dayjs.utc(market.endTime);
          const aggregatedEndTime = dayjs.utc(aggregated.endTime);
          if (marketEndTime.isAfter(aggregatedEndTime) || 
              (market.status === 'OPEN' && aggregated.status !== 'OPEN')) {
            aggregated.id = market.id;
            aggregated.status = market.status;
            aggregated.endTime = market.endTime;
            aggregated.yesPercent = market.yesPercent;
          }
        });
        
        // 🚀 强制修复：对于工厂市场，必须使用全量数据（allMarketsForStats）进行暴力统计
        // 重置工厂市场的统计，然后使用全量数据重新统计
        const factoryTemplateIds = new Set<string>();
        allMarketsForStats.forEach(m => {
          if (m.isFactory === true && m.templateId) {
            factoryTemplateIds.add(m.templateId);
          }
        });
        
        // 重置所有工厂市场的统计
        factoryTemplateIds.forEach(templateId => {
          const aggregated = aggregatedMap.get(templateId);
          if (aggregated && aggregated.isFactory === true) {
            aggregated.stats.open = 0;
            aggregated.stats.pending = 0;
            aggregated.stats.resolved = 0;
            aggregated.stats.historical = 0;
            aggregated.stats.total = 0;
            aggregated.stats.totalActive = 0;
            aggregated.stats.ended = 0;
            aggregated.marketIds = [];
            aggregated.activeMarketIds = [];
            aggregated.historicalMarketIds = [];
          }
        });
        
        // 遍历所有工厂市场（全量），强制统计
        let factoryOpenCount = 0;
        let factoryClosedCount = 0;
        let factoryOtherCount = 0;
        
        allMarketsForStats.forEach((market) => {
          // 只处理工厂市场
          if (market.isFactory !== true) {
            return; // 跳过非工厂市场（已经在上面处理过了）
          }
          
          // 统计状态分布（用于调试）
          if (market.status === 'OPEN') {
            factoryOpenCount++;
          } else if (market.status === 'CLOSED') {
            factoryClosedCount++;
          } else {
            factoryOtherCount++;
          }
          
          // 🔧 只记录前10个的详细信息，避免日志过多
          if (factoryOpenCount + factoryClosedCount + factoryOtherCount <= 10) {

          }
          
          const groupKey = market.templateId ? market.templateId : `independent-${market.id}`;
          const aggregated = aggregatedMap.get(groupKey);
          
          if (!aggregated) {
            console.warn(`⚠️ [ForceStats] 聚合记录不存在: templateId=${market.templateId}`);
            return;
          }
          
          // 🚀 暴力统计：只要是工厂的，总数必须加 1
          aggregated.stats.total++;
          // 🚀 推送市场详情对象而不是 ID
          const marketDetail = marketDetailMap.get(market.id);
          if (marketDetail) {
            aggregated.marketIds.push(marketDetail);
          }
          
          // 🚀 强制逻辑：OPEN 算 open，其他全部算 ended
          if (market.status === 'OPEN') {
            aggregated.stats.open++;
            aggregated.stats.totalActive++;
            if (marketDetail) aggregated.activeMarketIds.push(marketDetail);
            if (factoryOpenCount <= 5) {

            }
          } else {
            // PENDING, RESOLVED, CLOSED, CANCELED, SETTLING 全部归为 Ended
            aggregated.stats.ended = (aggregated.stats.ended || 0) + 1;
            
            // 同时更新对应的状态计数
            if (market.status === 'PENDING' || market.status === 'SETTLING' || market.status === 'CLOSED') {
              aggregated.stats.pending++;
            } else if (market.status === 'RESOLVED') {
              aggregated.stats.resolved++;
            }
            
            if (marketDetail) aggregated.activeMarketIds.push(marketDetail);
            if (factoryClosedCount + factoryOtherCount <= 5) {

            }
          }
        });

        // 🚀 计算聚合后的交易统计数据（批量查询所有聚合系列的订单）
        // 🚀 修复：marketIds 现在是对象数组，需要提取 id
        const allAggregatedMarketIds = Array.from(aggregatedMap.values())
          .flatMap(agg => (agg.marketIds && Array.isArray(agg.marketIds)) ? agg.marketIds.map((m: any) => typeof m === 'string' ? m : m.id) : [])
          .filter(Boolean);
        
        if (allAggregatedMarketIds.length > 0) {
          // 🚀 工厂市场：24小时滚动统计
          // 计算24小时前的时间点（UTC）
          const twentyFourHoursAgo = dayjs.utc().subtract(24, 'hour').toDate();
          
          // 🔥 修复：使用兼容的方式查询订单统计
          // 1. 一次性查询所有聚合市场的订单数（只统计最近24小时内的订单）
          const allSeriesOrderStats = await prisma.orders.groupBy({
            by: ['marketId'],
            where: {
              marketId: { in: allAggregatedMarketIds },
              createdAt: {
                gte: twentyFourHoursAgo, // 🚀 只统计最近24小时内的订单
              },
            },
            _count: {
              id: true, // 每个场次的订单数
            },
          });
          
          // 2. 一次性查询所有聚合市场的用户ID（用于去重，只统计最近24小时内的订单）
          const allSeriesUserIds = await prisma.orders.findMany({
            where: {
              marketId: { in: allAggregatedMarketIds },
              createdAt: {
                gte: twentyFourHoursAgo, // 🚀 只统计最近24小时内的订单
              },
            },
            select: {
              marketId: true,
              userId: true,
            },
          });
          
          // 3. 构建市场ID到订单数的映射
          const marketOrderCountMap = new Map(
            allSeriesOrderStats.map(stat => [stat.marketId, stat._count.id || 0])
          );
          
          // 4. 构建市场ID到用户ID集合的映射
          const marketUserIdsMap = new Map<string, Set<string>>();
          allSeriesUserIds.forEach(order => {
            if (!marketUserIdsMap.has(order.marketId)) {
              marketUserIdsMap.set(order.marketId, new Set());
            }
            marketUserIdsMap.get(order.marketId)!.add(order.userId);
          });
          
          // 5. 为每个聚合系列计算交易统计
          for (const aggregated of aggregatedMap.values()) {
            if (aggregated.marketIds && Array.isArray(aggregated.marketIds) && aggregated.marketIds.length > 0) {
              // 🚀 修复：marketIds 现在是对象数组，需要提取 id
              const marketIdList = aggregated.marketIds.map((m: any) => typeof m === 'string' ? m : m.id);
              // 计算该系列下所有场次的总订单数
              const totalOrderCount = marketIdList.reduce(
                (sum: number, marketId: string) => sum + (marketOrderCountMap.get(marketId) || 0),
                0
              );
              
              // 计算该系列下所有场次的唯一用户数（去重）
              const allUserIdsSet = new Set<string>();
              marketIdList.forEach((marketId: string) => {
                const userIds = marketUserIdsMap.get(marketId);
                if (userIds) {
                  userIds.forEach(userId => allUserIdsSet.add(userId));
                }
              });
              
              aggregated.tradingStats = {
                userCount: allUserIdsSet.size,
                orderCount: totalOrderCount,
              };
              
              // 🚀 调试日志：打印聚合统计结果
              if (aggregated.templateId) {

              }
            } else {
              // 如果没有场次，使用单个市场的统计数据
              const singleMarketStats = orderStatsMap.get(aggregated.id) || { userCount: 0, orderCount: 0 };
              aggregated.tradingStats = {
                userCount: singleMarketStats.userCount,
                orderCount: singleMarketStats.orderCount,
              };
              
              // 🚀 调试日志：打印单个市场统计结果

            }
            
            // 删除临时字段
            delete (aggregated as any)._userIds;
          }
        } else {
          // 如果没有聚合市场，为所有市场设置默认值
          for (const aggregated of aggregatedMap.values()) {
            const singleMarketStats = orderStatsMap.get(aggregated.id) || { userCount: 0, orderCount: 0 };
            aggregated.tradingStats = {
              userCount: singleMarketStats.userCount,
              orderCount: singleMarketStats.orderCount,
            };
            
            // 🚀 调试日志：打印单个市场统计结果（无聚合情况）

            delete (aggregated as any)._userIds;
          }
        }
        
        // 🔥 补充历史统计：遍历所有市场（包括历史的）来统计完整的历史数量
        // 🚀 修复：工厂市场不应该被标记为历史（36小时窗口内的所有场次都是活跃的）
        allMarketsForStats.forEach((market) => {
          // 🔥 使用相同的聚合键逻辑，确保统计一致性
          const groupKey = market.templateId ? market.templateId : `independent-${market.id}`;
          if (aggregatedMap.has(groupKey)) {
            const aggregated = aggregatedMap.get(groupKey)!;
            // 🚀 修复：工厂市场不应该被标记为历史
            const isFactoryMarketForStats = aggregated.isFactory === true;
            const isHistorical = !isFactoryMarketForStats && market.status === 'RESOLVED' && 
              dayjs.utc(market.endTime).isBefore(now.subtract(48, 'hour'));
            
            // 如果这个市场是历史记录且不在已统计的市场 ID 列表中
            if (isHistorical) {
              // 检查是否已经统计过（避免重复）
              const existingIds = (aggregated.marketIds || []).map((m: any) => typeof m === 'string' ? m : m.id);
              if (!existingIds.includes(market.id)) {
                aggregated.stats.historical++;
                aggregated.stats.total++;
                if (!aggregated.historicalMarketIds) {
                  aggregated.historicalMarketIds = [];
                }
                if (!aggregated.marketIds) {
                  aggregated.marketIds = [];
                }
                const marketDetail = marketDetailMap.get(market.id);
                if (marketDetail) {
                  aggregated.historicalMarketIds.push(marketDetail);
                  aggregated.marketIds.push(marketDetail);
                }
              }
            }
          }
        });
        
        filteredMarkets = Array.from(aggregatedMap.values());

      }
    } catch (dbError) {
      console.error('❌ [Admin Markets GET] 数据库查询失败:');
      console.error('错误类型:', dbError instanceof Error ? dbError.constructor.name : typeof dbError);
      console.error('错误消息:', dbError instanceof Error ? dbError.message : String(dbError));
      console.error('错误堆栈:', dbError instanceof Error ? dbError.stack : 'N/A');
      throw dbError; // 重新抛出，让外层 catch 处理
    }

    // 搜索过滤（按ID、标题或 templateId）
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredMarkets = filteredMarkets.filter((market: any) => {
        return (
          market.id.toLowerCase().includes(searchLower) ||
          market.title.toLowerCase().includes(searchLower) ||
          (market.templateId && market.templateId.toLowerCase().includes(searchLower))
        );
      });
    }

    // 状态过滤（对于聚合数据，检查是否有对应状态的场次）
    if (statusFilter) {
      const statusMap: Record<string, MarketStatus> = {
        open: MarketStatus.OPEN,
        closed: MarketStatus.CLOSED,
        resolved: MarketStatus.RESOLVED,
        canceled: MarketStatus.CANCELED,
        'pending_review': 'PENDING_REVIEW' as MarketStatus,
      };
      const targetStatus = statusMap[statusFilter.toLowerCase()];
      if (targetStatus) {
        filteredMarkets = filteredMarkets.filter((market: any) => {
          // 如果是聚合数据（有 stats 字段），检查统计
          if (market.stats) {
            if (targetStatus === MarketStatus.OPEN) return market.stats.open > 0;
            if (targetStatus === ('PENDING_REVIEW' as MarketStatus)) return market.stats.pending_review > 0;
            if (targetStatus === MarketStatus.RESOLVED) return market.stats.resolved > 0;
            if (targetStatus === MarketStatus.CLOSED) return market.stats.closed > 0;
          }
          // 普通市场，直接匹配状态
          return market.status === targetStatus;
        });
      }
    }

    // 计算分页
    // 🔥 统一统计数字：聚合视图时使用聚合后的数量，详细视图时使用实际数量
    const total = filteredMarkets.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedMarkets = filteredMarkets.slice(startIndex, endIndex);

    // 🔥 修复 JSON 序列化问题：确保所有数值字段都是有效的数字（不是 BigInt、NaN 或 Infinity）
    const convertToNumberSafe = (value: any): number => {
        if (value === null || value === undefined) return 0;
      if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        }
        const num = Number(value);
        return isNaN(num) || !isFinite(num) ? 0 : num;
      };

    const sanitizedMarkets = paginatedMarkets.map((market: any) => {
      // 创建一个安全的副本，确保所有数值字段都是 Number 类型
      const safeMarket: any = {
        ...market,
        // 🔥 数值字段显式转换为 Number（处理 BigInt）
        totalVolume: convertToNumberSafe(market.totalVolume || market.internalVolume || 0), // 🚀 修复：使用本地交易量
        totalYes: convertToNumberSafe(market.totalYes || 0),
        totalNo: convertToNumberSafe(market.totalNo || 0),
        feeRate: convertToNumberSafe(market.feeRate || 0.05),
        volume: convertToNumberSafe(market.volume || market.internalVolume || 0), // 🚀 修复：使用本地交易量
        yesPercent: convertToNumberSafe(market.yesPercent || 50),
        // 🔥 新字段：确保是数字类型（处理 BigInt）
        externalVolume: convertToNumberSafe(market.externalVolume || 0),
        internalVolume: convertToNumberSafe(market.internalVolume || 0),
        manualOffset: convertToNumberSafe(market.manualOffset || 0),
        // 布尔字段
        isActive: Boolean(market.isActive !== false),
        isHot: Boolean(market.isHot || false),
      };

      // 如果聚合数据有 stats，也需要确保 stats 中的数值是有效的
      if (safeMarket.stats) {
        safeMarket.stats = {
          open: convertToNumberSafe(safeMarket.stats.open || 0),
          pending: convertToNumberSafe(safeMarket.stats.pending || 0),
          resolved: convertToNumberSafe(safeMarket.stats.resolved || 0),
          historical: convertToNumberSafe(safeMarket.stats.historical || 0),
          total: convertToNumberSafe(safeMarket.stats.total || 0),
          totalActive: convertToNumberSafe(safeMarket.stats.totalActive || 0),
          ended: convertToNumberSafe(safeMarket.stats.ended || 0), // 🔧 关键修复：添加 ended 字段
        };
      }
      
      // 确保 marketIds 数组存在（聚合数据需要这些字段）
      if (safeMarket.stats) {
        if (!safeMarket.marketIds) {
          safeMarket.marketIds = [];
        }
        if (!safeMarket.activeMarketIds) {
          safeMarket.activeMarketIds = [];
        }
        if (!safeMarket.historicalMarketIds) {
          safeMarket.historicalMarketIds = [];
        }
      }

      return safeMarket;
    });

    return NextResponse.json({
      success: true,
      data: sanitizedMarkets,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }, { status: 200 });
  } catch (error) {
    console.error('❌ [Admin Markets GET] ========== 获取市场列表失败 ==========');
    console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('错误消息:', error instanceof Error ? error.message : String(error));
    
    // 🔥 深度打印错误对象（查看完整的错误结构，包括所有属性）
    console.error('❌ [Admin Markets GET] 错误对象完整详情:');
    console.dir(error, { depth: null, colors: true });
    
    // 打印错误堆栈
    console.error('❌ [Admin Markets GET] 完整错误堆栈:');
    if (error instanceof Error) {
      console.error(error.stack);
      // 如果错误有 cause 属性，也打印出来
      if ((error as any).cause) {
        console.error('❌ [Admin Markets GET] 错误原因 (cause):');
        console.dir((error as any).cause, { depth: null, colors: true });
      }
    } else {
      console.error('原始错误对象:', error);
      // 尝试 JSON 序列化错误对象
      try {
        console.error('错误对象 JSON:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (jsonError) {
        console.error('无法序列化错误对象为 JSON');
      }
    }
    
    console.error('❌ [Admin Markets GET] ===============================');

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        // 开发环境下返回详细错误信息
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? { 
              details: error.message, 
              stack: error.stack,
              name: error.name,
            }
          : {}),
      },
      { status: 500 }
    );
  }
}

/**
 * 管理后台 - 创建市场 API
 * POST /api/admin/markets
 * 
 * 🔥 管理员权限：允许管理员手动创建市场
 * 系统有三个合法生产者：
 * 1. 自动化的"工厂"（factory-pregen）
 * 2. 人工干预的"事件审核中心"（polymarketService）
 * 3. 人工自主创建市场（此接口）
 */
export async function POST(request: Request) {
  try {

    // 权限校验：使用 NextAuth session 验证管理员身份

    const session = await auth();
    
    // 🔥 修复 500 错误：确保 session 和 user 不为 null
    if (!session || !session.user) {
      console.error('❌ [Market API] Session 验证失败: session 或 user 为空');
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }
    
    // 🔥 双重校验：角色为 ADMIN 或邮箱为管理员邮箱
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com'; // 管理员邮箱
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      console.error('❌ [Market API] 权限验证失败:', { userRole, userEmail });
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized. Admin access required.',
        },
        { status: 401 }
      );
    }

    // 解析请求体

    const body = await request.json();
    
    // 🔥 强制要求：在创建市场之前打印完整的接收数据

    const {
      title,
      description,
      category,
      categories, // 🔥 支持多分类数组（可选）
      endTime,
      imageUrl,
      sourceUrl,
      resolutionCriteria,
      feeRate, // 接收手续费率参数
      isHot, // 🔥 接收热门标记
      initialLiquidity, // 🔥 第一步：接收平台启动资金参数
    } = body;

    // 数据验证调试：打印接收到的市场数据

    // 验证必需字段
    if (!title || !category || !endTime) {
      console.error('❌ [Market API] 缺少必需字段:', {
        hasTitle: !!title,
        hasCategory: !!category,
        hasEndTime: !!endTime,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: title, category, and endTime are required',
        },
        { status: 400 }
      );
    }

    // 🔥 完全移除旧的 categoryNameToQuery 逻辑，不再使用 name 或 slug 查询

    // 验证日期格式

    const endDate = new Date(endTime);
    if (isNaN(endDate.getTime())) {
      console.error('❌ [Market API] 无效的日期格式:', endTime);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid endTime format. Please use ISO 8601 format (e.g., "2024-12-31T23:59:59Z")',
        },
        { status: 400 }
      );
    }

    // 验证日期不能是过去
    const nowTimestamp = Date.now();
    const endTimestamp = endDate.getTime();

    if (endTimestamp < nowTimestamp) {
      console.error('❌ [Market API] 截止日期不能是过去:', { endTime, endTimestamp, nowTimestamp });
      return NextResponse.json(
        {
          success: false,
          error: 'endTime cannot be in the past',
        },
        { status: 400 }
      );
    }

    // 解析费率
    const parsedFeeRate = feeRate !== undefined ? parseFloat(feeRate) : 0.05;

    // 🚀 核心修复：支持通过 ID 或 slug 查找分类
    // 1. 提取前端传来的分类标识（可能是 ID 或 slug）
    const categoryIds = Array.isArray(body.categories) ? body.categories : [];

    // 2. 只有在标识数组不为空时才进行验证和关联
    let validCategoryConnect: Array<{ id: string }> = [];
    if (categoryIds.length > 0) {
      // 🚀 修复：支持通过 ID 或 slug 查找分类
      // 如果标识是 "-1"（热门分类的 slug），通过 slug 查找，再获取其真实 ID
      const categoryPromises = categoryIds.map(async (identifier: string) => {
        // 先尝试按 ID 查找（最常见情况）
        let category = await prisma.categories.findUnique({
          where: { id: identifier },
          select: { id: true },
        });
        
        // 如果按 ID 找不到，尝试按 slug 查找（支持 "-1" 或 "hot" 这种特殊情况）
        if (!category && (identifier === "-1" || identifier === "hot")) {
          category = await prisma.categories.findFirst({
            where: {
              OR: [
                { slug: identifier },
                { slug: identifier === "-1" ? "-1" : "hot" },
                { name: { contains: "热门" } }
              ].filter(Boolean),
            },
            select: { id: true },
          });
        }
        
        // 🚀 如果仍然找不到，尝试所有可能的查找方式（兜底逻辑）
        if (!category) {
          category = await prisma.categories.findFirst({
        where: {
              OR: [
                { id: identifier },
                { slug: identifier },
                { name: identifier }
              ],
        },
        select: { id: true },
          });
        }
        
        return category;
      });
      
      const foundCategories = (await Promise.all(categoryPromises)).filter(Boolean) as Array<{ id: string }>;
      validCategoryConnect = foundCategories;

      
      // 🚀 诊断日志：如果前端传来 "-1" 但找不到，给出详细提示
      const notFoundIds = categoryIds.filter((id: string) => !validCategoryConnect.some(c => c.id === id));
      if (notFoundIds.length > 0) {
        console.warn('⚠️ [Market API] 以下分类标识未找到:', notFoundIds);
        console.warn('   提示：如果是 "-1" 或 "hot"，请检查数据库中是否存在 slug 为 "-1" 或 "hot" 的分类');
      }
    } else {
      console.warn('⚠️ [Market API] 前端未提供分类标识，将创建市场但不关联分类');
    }

    // 🔥 修复热门标签逻辑：检查是否包含热门分类（ID=-1 或 slug="-1"），如果包含，自动设置 isHot = true
    const hotCategory = await prisma.categories.findFirst({
      where: {
        OR: [
          { slug: '-1' },
          { slug: 'hot' },
          { name: { contains: '热门' } },
        ],
      },
      select: { id: true },
    });
    
    // 如果分类列表中包含热门分类，自动设置 isHot = true（覆盖前端传入的值）
    const hasHotCategory = hotCategory && validCategoryConnect.some(c => c.id === hotCategory.id);
    const finalIsHot = hasHotCategory ? true : (isHot === true ? true : false);

    // 🔥 第一步：处理流动性注入逻辑
    const liquidityAmount = initialLiquidity ? parseFloat(String(initialLiquidity)) : 0;
    const shouldInjectLiquidity = liquidityAmount > 0;

    // 如果指定了流动性注入，检查流动性账户余额
    if (shouldInjectLiquidity) {
      const liquidityAccount = await prisma.users.findFirst({
        where: { email: 'system.liquidity@yesno.com' },
        select: { id: true, balance: true },
      });

      if (!liquidityAccount) {
        return NextResponse.json(
          {
            success: false,
            error: '流动性账户不存在，请先创建系统账户',
          },
          { status: 400 }
        );
      }

      if (liquidityAccount.balance < liquidityAmount) {
        return NextResponse.json(
          {
            success: false,
            error: `流动性账户余额不足：当前余额 $${liquidityAccount.balance.toFixed(2)}，需要 $${liquidityAmount.toFixed(2)}`,
          },
          { status: 400 }
        );
      }
    }

    const marketData: any = {
      title: body.title,
      description: body.description || "",
      closingDate: new Date(body.closingDate || endTime),
      status: "OPEN",
      reviewStatus: "PUBLISHED", // 🔥 修复：新创建的市场直接设为 PUBLISHED，确保前端能显示
      source: "INTERNAL",
      isActive: true,
      externalVolume: 0,
      internalVolume: 0,
      manualOffset: 0,
      resolvedOutcome: null,
      isHot: finalIsHot, // 🔥 修复：如果包含热门分类，自动设置为 true
      // 🔥 第一步：如果指定了流动性注入，初始化 totalYes 和 totalNo（默认 50/50 分配）
      totalYes: shouldInjectLiquidity ? liquidityAmount * 0.5 : 0,
      totalNo: shouldInjectLiquidity ? liquidityAmount * 0.5 : 0,
    };

    // 🔥 管理员权限：允许管理员手动创建市场
    // 为新市场生成 templateId（使用 manual- 前缀标识手动创建）
    const crypto = await import('crypto');
    const templateId = `manual-${crypto.randomUUID()}`;
    marketData.templateId = templateId;

    // 🔥 修正 prisma.markets.create 调用：根据 MarketCategory 中间表结构，使用 create 语法
    // 参考 scripts/seed-pending-markets.ts 的实现方式
    // MarketCategory 表的字段是 categoryId，不是嵌套的 category 对象
    if (validCategoryConnect.length > 0) {
      marketData.categories = {
        create: validCategoryConnect.map(c => ({
          categoryId: c.id, // 🔥 直接使用 categoryId 字段，不需要嵌套 connect
        })),
      };

    } else {
      console.warn('⚠️ [Market API] 没有有效的分类，创建市场但不关联分类');
    }

    // 🔥 第一步：使用事务确保市场创建和流动性注入的原子性
    const result = await prisma.$transaction(async (tx) => {
      // 创建市场
      const newMarket = await tx.markets.create({
        data: marketData,
      });

      // 如果指定了流动性注入，执行真实扣款和记录流水
      if (shouldInjectLiquidity) {
        const liquidityAccount = await tx.users.findFirst({
          where: { email: 'system.liquidity@yesno.com' },
        });

        if (!liquidityAccount) {
          throw new Error('流动性账户不存在');
        }

        // 从流动性账户扣减余额
        const updatedAccount = await tx.users.update({
          where: { id: liquidityAccount.id },
          data: {
            balance: {
              decrement: liquidityAmount, // 使用 decrement 确保原子性
            },
          },
        });

        // 创建 Transaction 记录（负数表示支出）
        const { randomUUID } = await import('crypto');
        await tx.transactions.create({
          data: {
            id: randomUUID(),
            userId: liquidityAccount.id,
            amount: -liquidityAmount, // 负数表示从账户扣减
            type: 'ADMIN_ADJUSTMENT',
            reason: `市场创建初始流动性注入 - 市场ID: ${newMarket.id}`,
            status: 'COMPLETED',
          },
        });

        console.log(`✅ [Market API] 流动性注入成功: 市场 ${newMarket.id}, 金额 $${liquidityAmount}, 流动性账户余额: $${updatedAccount.balance}`);
      }

      return newMarket;
    });

    const newMarket = result;

    // 处理 BigInt 序列化并返回
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Market created successfully.',
      marketId: newMarket.id,
      data: JSON.parse(JSON.stringify(newMarket, (k, v) => typeof v === 'bigint' ? v.toString() : v)) 
    }), { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error("🔥 创建市场失败:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

