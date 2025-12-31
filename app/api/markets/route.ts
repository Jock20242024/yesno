import { NextResponse } from 'next/server';
import { DBService } from '@/lib/dbService'; // 🔥 修复：使用正确的 dbService 而不是 mockData
import { MarketStatus, Outcome } from '@/types/data';
import { calculateDisplayVolume } from '@/lib/marketUtils'; // 计算展示交易量
import { prisma } from '@/lib/prisma';
import dayjs from '@/lib/dayjs';
import { aggregateMarketsByTemplate } from '@/lib/marketAggregation'; // 🔥 使用公共聚合函数
import { BASE_MARKET_FILTER, buildHotMarketFilter, buildCategoryMarketFilter } from '@/lib/marketQuery'; // 🚀 统一过滤器
import { isIndependentMarket } from '@/lib/marketTypeDetection'; // 🚀 市场类型检测
import { createNoCacheResponse } from '@/lib/responseHelpers'; // 🔥 创建禁用缓存的响应

// 🔥 强制清理前端缓存：确保不使用旧缓存
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 市场列表 API
 * GET /api/markets
 * 
 * 返回所有市场的列表
 * 支持查询参数：
 * - category: 分类筛选
 * - status: 状态筛选 (OPEN, RESOLVED, CLOSED)
 * - search: 搜索关键词
 * - page: 页码
 * - pageSize: 每页数量
 */
export async function GET(request: Request) {
  try {
    console.log('📊 [Markets API] ========== 开始处理获取市场列表请求 ==========');
    
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const status = searchParams.get('status') as 'OPEN' | 'RESOLVED' | 'CLOSED' | null;
    const search = searchParams.get('search');
    const templateId = searchParams.get('templateId'); // 🔥 支持按 templateId 筛选
    const page = parseInt(searchParams.get('page') || '1');
    // 🔥 提升默认查询数量到 100，确保在聚合后依然有足够多的不同币种展示
    const pageSize = parseInt(searchParams.get('pageSize') || '100');
    const includePending = searchParams.get('includePending') === 'true'; // 仅管理员可设置

    console.log('📊 [Markets API] 查询参数:', {
      category,
      status,
      search,
      templateId,
      page,
      pageSize,
      includePending,
    });

    // 🔥 注意：DBService.getAllMarkets 已经包含 isActive: true 过滤

    // 检查是否为管理员请求（可以通过特殊参数或 session 判断）
    // 非管理员请求默认只返回已发布的市场

    // 🚀 提取公共转换函数（在所有查询之前定义）
    function convertDbMarketToMarketFormat(dbMarket: any): any {
      const source = dbMarket.source || 'INTERNAL';
      const externalVolume = dbMarket.externalVolume ?? 0;
      const internalVolume = dbMarket.internalVolume ?? 0;
      const manualOffset = dbMarket.manualOffset ?? 0;
      const isActive = dbMarket.isActive ?? true;
      
      const convertToNumber = (value: any): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'bigint') {
          try { return Number(value); } catch { return 0; }
        }
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        }
        const num = Number(value);
        return isNaN(num) || !isFinite(num) ? 0 : num;
      };
      
      const safeTotalVolume = convertToNumber(dbMarket.totalVolume);
      const safeTotalYes = convertToNumber(dbMarket.totalYes);
      const safeTotalNo = convertToNumber(dbMarket.totalNo);
      const safeFeeRate = convertToNumber(dbMarket.feeRate) || 0.05;
      
      let safeYesPercent = 50;
      let safeNoPercent = 50;
      if (safeTotalYes > 0 || safeTotalNo > 0) {
        const totalAmount = safeTotalYes + safeTotalNo;
        const calculatedYes = Math.round((safeTotalYes / totalAmount) * 100);
        const calculatedNo = Math.round((safeTotalNo / totalAmount) * 100);
        safeYesPercent = isNaN(calculatedYes) || !isFinite(calculatedYes) ? 50 : calculatedYes;
        safeNoPercent = isNaN(calculatedNo) || !isFinite(calculatedNo) ? 50 : calculatedNo;
      }
      
      return {
        id: dbMarket.id,
        title: dbMarket.title,
        description: dbMarket.description,
        closingDate: dbMarket.closingDate.toISOString(),
        resolvedOutcome: dbMarket.resolvedOutcome as Outcome | undefined,
        status: dbMarket.status as MarketStatus,
        totalVolume: safeTotalVolume,
        totalYes: safeTotalYes,
        totalNo: safeTotalNo,
        feeRate: safeFeeRate,
        category: dbMarket.categories[0]?.category?.name || dbMarket.category || undefined,
        categorySlug: dbMarket.categories[0]?.category?.slug || dbMarket.categorySlug || undefined,
        createdAt: dbMarket.createdAt.toISOString(),
        volume: safeTotalVolume,
        yesPercent: safeYesPercent,
        noPercent: safeNoPercent,
        source: source as 'POLYMARKET' | 'INTERNAL',
        externalVolume,
        internalVolume,
        manualOffset,
        isActive,
        isHot: (dbMarket as any).isHot || false,
        isFactory: (dbMarket as any).isFactory || false,
        templateId: (dbMarket as any).templateId || null,
        period: (dbMarket as any).period || null,
        symbol: (dbMarket as any).symbol || null,
        image: (dbMarket as any).image || null,
        iconUrl: (dbMarket as any).iconUrl || null,
        outcomePrices: (dbMarket as any).outcomePrices || null,
        initialPrice: (dbMarket as any).initialPrice || null,
        externalId: (dbMarket as any).externalId || null,
        originalImage: (dbMarket as any).image || null,
        scrapedImage: (dbMarket as any).image || null,
        polyOdds: (dbMarket as any).outcomePrices || null,
        sourceUrl: (dbMarket as any).externalId ? `https://polymarket.com/event/${(dbMarket as any).externalId}` : null,
      } as any;
    }
    
    // 🔥 特殊处理：hot 和 all
    // 🚀 物理重构：使用统一过滤器
    let filteredMarkets: any[] = [];
    
    // 🔥 修复：如果指定了 status 参数，需要构建自定义的 baseFilter，不限制 status
    const customBaseFilter = status 
      ? { isActive: true, reviewStatus: 'PUBLISHED' as const } // 不限制 status
      : BASE_MARKET_FILTER; // 默认只查询 OPEN 状态
    
    try {
      if (category === 'hot' || category === '-1') {
        console.log('🔥 [Markets API] 获取热门市场');
        console.log(`🔍 [Markets API] category 参数: ${category}，使用统一热门过滤器`);
        
        // 🚀 使用统一的热门市场过滤器（异步版本，获取真实的热门分类UUID）
        // 🔥 修复：传入自定义的 baseFilter 以支持 status 筛选
        const whereCondition = await buildHotMarketFilter(customBaseFilter);
        if (status) {
          // 🔥 如果指定了 status，添加到查询条件中
          const statusMap: Record<string, string> = {
            OPEN: 'OPEN',
            RESOLVED: 'RESOLVED',
            CLOSED: 'CLOSED',
            CANCELED: 'CANCELED',
          };
          const targetStatus = statusMap[status];
          if (targetStatus) {
            (whereCondition as any).status = targetStatus;
          }
        }
        
        console.log('📋 [Markets API] 热门市场查询条件:', JSON.stringify(whereCondition, null, 2));
        
        const dbMarkets = await prisma.market.findMany({
          where: whereCondition,
          include: {
            categories: {
              include: {
                category: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { isHot: 'desc' },
            { totalVolume: 'desc' }
          ],
        });
        
        // 转换为 Market 格式
        const convertedMarkets = dbMarkets.map(convertDbMarketToMarketFormat);
        
        // 🔥 物理重构：分离聚合项和独立项
        // 🚀 修复：manual- 和 poly- 开头的市场应该被当作独立市场，不参与聚合
        const marketsWithTemplate = convertedMarkets.filter((m: any) => m.templateId && !isIndependentMarket(m));
        const independentMarkets = convertedMarkets.filter((m: any) => isIndependentMarket(m));
        
        const aggregatedMarkets = aggregateMarketsByTemplate(marketsWithTemplate);
        filteredMarkets = [...aggregatedMarkets, ...independentMarkets];
      } else if (templateId) {
        // 🔥 按 templateId 筛选市场（用于详情页获取同模板的所有场次）
        console.log('📊 [Markets API] 按 templateId 筛选市场:', templateId);
        // 🔥 修复：如果指定了 status 参数，使用自定义 baseFilter
        const whereCondition: any = {
          ...customBaseFilter,
          templateId: templateId,
        };
        if (status) {
          const statusMap: Record<string, string> = {
            OPEN: 'OPEN',
            RESOLVED: 'RESOLVED',
            CLOSED: 'CLOSED',
            CANCELED: 'CANCELED',
          };
          const targetStatus = statusMap[status];
          if (targetStatus) {
            whereCondition.status = targetStatus;
          }
        }
        const dbMarkets = await prisma.market.findMany({
          where: whereCondition,
          include: {
            categories: {
              include: {
                category: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
          orderBy: {
            closingDate: 'asc',
          },
        });
        
        // 转换为 Market 格式
        const convertedMarkets = dbMarkets.map(convertDbMarketToMarketFormat);
        
        // 🔥 物理重构：分离聚合项和独立项
        // 🚀 修复：manual- 和 poly- 开头的市场应该被当作独立市场，不参与聚合
        const marketsWithTemplate = convertedMarkets.filter((m: any) => m.templateId && !isIndependentMarket(m));
        const independentMarkets = convertedMarkets.filter((m: any) => isIndependentMarket(m));
        
        const aggregatedMarkets = aggregateMarketsByTemplate(marketsWithTemplate);
        filteredMarkets = [...aggregatedMarkets, ...independentMarkets];
      } else if (category === 'all') {
        // 所有市场：使用基础过滤器
        console.log('📊 [Markets API] 获取所有市场');
        // 🔥 修复：如果指定了 status 参数，使用自定义 baseFilter
        const whereCondition: any = { ...customBaseFilter };
        if (status) {
          const statusMap: Record<string, string> = {
            OPEN: 'OPEN',
            RESOLVED: 'RESOLVED',
            CLOSED: 'CLOSED',
            CANCELED: 'CANCELED',
          };
          const targetStatus = statusMap[status];
          if (targetStatus) {
            whereCondition.status = targetStatus;
          }
        }
        const dbMarkets = await prisma.market.findMany({
          where: whereCondition,
          include: {
            categories: {
              include: {
                category: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { isHot: 'desc' },
            { totalVolume: 'desc' }
          ],
        });
        
        // 转换格式（复用热门市场的转换逻辑）
        const convertedMarkets = dbMarkets.map((dbMarket) => {
          // ... 转换逻辑与热门市场相同，可以提取为公共函数
          // 为简化，这里直接使用相同的转换逻辑
          return convertDbMarketToMarketFormat(dbMarket);
        });
        
        // 分离聚合项和独立项
        // 🚀 修复：manual- 和 poly- 开头的市场应该被当作独立市场，不参与聚合
        const marketsWithTemplate = convertedMarkets.filter((m: any) => m.templateId && !isIndependentMarket(m));
        const independentMarkets = convertedMarkets.filter((m: any) => isIndependentMarket(m));
        
        const aggregatedMarkets = aggregateMarketsByTemplate(marketsWithTemplate);
        filteredMarkets = [...aggregatedMarkets, ...independentMarkets];
      } else if (category) {
        // 🚀 普通分类筛选：使用统一过滤器
        console.log(`📊 [Markets API] 获取分类 '${category}' 的市场`);
        
        // 先根据 slug 获取分类及其所有子分类
        const categoryRecord = await prisma.category.findUnique({
          where: { slug: category },
          include: {
            children: {
              select: { id: true },
            },
          },
        });
        
        if (!categoryRecord) {
          console.warn(`⚠️  [Markets API] 分类 '${category}' 不存在`);
          filteredMarkets = [];
        } else {
          // 🚀 第一步：实现递归分类查询 - 获取父分类及其所有子分类的ID
          const categoryIds = [categoryRecord.id, ...categoryRecord.children.map(child => child.id)];
          console.log(`📊 [Markets API] 分类 '${category}' 及其子分类ID:`, categoryIds);
          
          // 使用包含所有分类ID的过滤器
          // 🔥 修复：如果指定了 status 参数，使用自定义 baseFilter
          const whereCondition: any = {
            ...customBaseFilter,
            categories: {
              some: {
                categoryId: {
                  in: categoryIds, // 🚀 使用 in 查询包含父分类及其所有子分类
                },
              },
            },
          };
          if (status) {
            const statusMap: Record<string, string> = {
              OPEN: 'OPEN',
              RESOLVED: 'RESOLVED',
              CLOSED: 'CLOSED',
              CANCELED: 'CANCELED',
            };
            const targetStatus = statusMap[status];
            if (targetStatus) {
              whereCondition.status = targetStatus;
            }
          }
          
          const dbMarkets = await prisma.market.findMany({
            where: whereCondition,
            include: {
              categories: {
                include: {
                  category: {
                    select: {
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
            },
            orderBy: [
              { isHot: 'desc' },
              { totalVolume: 'desc' }
            ],
          });
          
          // 转换格式
          const convertedMarkets = dbMarkets.map(convertDbMarketToMarketFormat);
          
          // 分离聚合项和独立项
          // 🚀 修复：manual- 和 poly- 开头的市场应该被当作独立市场，不参与聚合
          const marketsWithTemplate = convertedMarkets.filter((m: any) => m.templateId && !isIndependentMarket(m));
          const independentMarkets = convertedMarkets.filter((m: any) => isIndependentMarket(m));
          
          const aggregatedMarkets = aggregateMarketsByTemplate(marketsWithTemplate);
          filteredMarkets = [...aggregatedMarkets, ...independentMarkets];
        }
      } else {
        // 🔥 修复：当 category 为 null 或空时，使用基础过滤器查询所有市场
        console.log('📊 [Markets API] 无分类参数，获取所有市场（使用基础过滤器）');
        // 🔥 修复：如果指定了 status 参数，使用自定义 baseFilter
        const whereCondition: any = { ...customBaseFilter };
        if (status) {
          const statusMap: Record<string, string> = {
            OPEN: 'OPEN',
            RESOLVED: 'RESOLVED',
            CLOSED: 'CLOSED',
            CANCELED: 'CANCELED',
          };
          const targetStatus = statusMap[status];
          if (targetStatus) {
            whereCondition.status = targetStatus;
          }
        }
        const dbMarkets = await prisma.market.findMany({
          where: whereCondition,
          include: {
            categories: {
              include: {
                category: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { isHot: 'desc' },
            { totalVolume: 'desc' }
          ],
        });
        
        // 转换格式
        const convertedMarkets = dbMarkets.map(convertDbMarketToMarketFormat);
        
        // 分离聚合项和独立项
        const marketsWithTemplate = convertedMarkets.filter((m: any) => m.templateId && !isIndependentMarket(m));
        const independentMarkets = convertedMarkets.filter((m: any) => isIndependentMarket(m));
        
        const aggregatedMarkets = aggregateMarketsByTemplate(marketsWithTemplate);
        filteredMarkets = [...aggregatedMarkets, ...independentMarkets];
      }
      console.log('✅ [Markets API] DBService.getAllMarkets 返回', filteredMarkets.length, '个市场');
      console.log('✅ [Markets API] 返回结果详情:', {
        totalMarkets: filteredMarkets.length,
        firstMarketId: filteredMarkets[0]?.id,
        firstMarketTitle: filteredMarkets[0]?.title,
        firstMarketCategory: filteredMarkets[0]?.category,
        firstMarketCategorySlug: filteredMarkets[0]?.categorySlug,
      });
    } catch (dbError) {
      console.error('❌ [Markets API] 数据库查询失败:');
      console.error('错误类型:', dbError instanceof Error ? dbError.constructor.name : typeof dbError);
      console.error('错误消息:', dbError instanceof Error ? dbError.message : String(dbError));
      console.error('错误堆栈:', dbError instanceof Error ? dbError.stack : 'N/A');
      throw dbError; // 重新抛出，让外层 catch 处理
    }

    // 状态筛选
    if (status) {
      const statusMap: Record<string, MarketStatus> = {
        OPEN: MarketStatus.OPEN,
        RESOLVED: MarketStatus.RESOLVED,
        CLOSED: MarketStatus.CLOSED,
        CANCELED: MarketStatus.CANCELED,
      };
      const targetStatus = statusMap[status];
      if (targetStatus) {
        filteredMarkets = filteredMarkets.filter(
          (market) => market.status === targetStatus
        );
      }
    }

    // 搜索过滤
    if (search) {
      const searchLower = search.toLowerCase();
      filteredMarkets = filteredMarkets.filter(
        (market) => market.title.toLowerCase().includes(searchLower) ||
                    market.description.toLowerCase().includes(searchLower)
      );
    }

    // 🚀 关键修复：在所有过滤之后、分页之前，再次进行聚合去重
    // 确保即使状态筛选或搜索过滤后，同一个系列仍然只保留一个代表场次
    // 但独立市场（templateId 为 null 或 manual-/poly- 开头）不受影响，直接保留
    // 🚀 强制过滤：确保 isActive 为 false 的市场绝对不会出现在结果中
    const beforeAggregationCount = filteredMarkets.length;
    
    // 🚀 物理防御：再次强制过滤 isActive === false 的市场（防御性编程）
    filteredMarkets = filteredMarkets.filter((m: any) => {
      const isActive = m.isActive !== false; // 确保只有 isActive !== false 的市场通过
      if (!isActive) {
        console.warn(`🚨 [Markets API] 发现 isActive=false 的市场，已过滤: ${m.id} (${m.title})`);
      }
      return isActive;
    });
    
    const marketsWithTemplate = filteredMarkets.filter((m: any) => (m as any).templateId && !isIndependentMarket(m));
    const independentMarkets = filteredMarkets.filter((m: any) => isIndependentMarket(m));
    
    const aggregatedMarkets = aggregateMarketsByTemplate(marketsWithTemplate);
    filteredMarkets = [...aggregatedMarkets, ...independentMarkets];
    
    const afterAggregationCount = filteredMarkets.length;
    console.log(`📊 [Markets API] 最终处理结果: 聚合项 ${aggregatedMarkets.length} 个，独立项 ${independentMarkets.length} 个，总计 ${afterAggregationCount} 个（处理前 ${beforeAggregationCount} 个）`);

    // 分页处理（使用聚合后的数量）
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedMarkets = filteredMarkets.slice(startIndex, endIndex);

    // 序列化调试：确保所有字段都能被正确序列化
    console.log('📊 [Markets API] 准备返回数据:', {
      totalMarkets: filteredMarkets.length,
      paginatedCount: paginatedMarkets.length,
      page,
      pageSize,
      totalPages: Math.ceil(filteredMarkets.length / pageSize),
    });

    // 确保所有日期字段都是字符串格式（ISO 8601），并包含所有字段
    // 🔥 添加 displayVolume 字段
    let serializedMarkets;
    try {
      serializedMarkets = paginatedMarkets
        .map((market) => {
        try {
          // 🔥 安全处理新字段：确保 source 有默认值（旧数据可能是 null）
          const marketSource = (market as any).source || 'INTERNAL';
          const externalVolume = (market as any).externalVolume ?? 0;
          const internalVolume = (market as any).internalVolume ?? 0;
          const manualOffset = (market as any).manualOffset ?? 0;

          const displayVolume = calculateDisplayVolume({
            source: marketSource as 'POLYMARKET' | 'INTERNAL',
            externalVolume,
            internalVolume,
            manualOffset,
          });
          
          // 🔥 计算赔率（基于 totalYes 和 totalNo，与详情页保持一致）
          const totalAmount = (market.totalYes || 0) + (market.totalNo || 0);
          const yesPercent = totalAmount > 0 
            ? Math.round(((market.totalYes || 0) / totalAmount) * 100 * 100) / 100 
            : 50;
          const noPercent = totalAmount > 0 
            ? Math.round(((market.totalNo || 0) / totalAmount) * 100 * 100) / 100 
            : 50;
          
          // 🔥 计算 currentPrice（YES 价格，0-1 之间）
          const currentPrice = totalAmount > 0 
            ? (market.totalYes || 0) / totalAmount 
            : 0.5;
          
          // 🚀 物理防御：在序列化时再次检查 isActive，确保已删除的市场绝对不会被返回
          if ((market as any).isActive === false) {
            console.error(`🚨 [Markets API] 序列化时发现 isActive=false 的市场，跳过: ${market.id} (${market.title})`);
            return null; // 返回 null，后续会被过滤掉
          }
          
          return {
            ...market,
            closingDate: typeof market.closingDate === 'string' 
              ? market.closingDate 
              : new Date(market.closingDate).toISOString(),
            createdAt: typeof market.createdAt === 'string' 
              ? market.createdAt 
              : new Date(market.createdAt).toISOString(),
            category: market.category || undefined,
            categorySlug: market.categorySlug || undefined,
            description: market.description || '', // 🔥 保留原始描述字段
            // 🔥 添加展示交易量字段
            displayVolume,
            volume: displayVolume, // 兼容字段
            totalVolume: displayVolume, // 兼容字段
            // 🔥 添加 volume24h（24小时交易量，优先使用数据库字段，否则使用 displayVolume）
          volume24h: (market as any).volume24h || displayVolume,
          // 🔥 添加赔率字段（从 totalYes 和 totalNo 计算）
          yesPercent,
          noPercent,
          // 🔥 添加 currentPrice（YES 价格，0-1 之间）
          currentPrice,
          // 🔥 核心修复：保留 Polymarket 爬取的原始字段（直接从数据库读取，不做任何覆盖）
          outcomePrices: (market as any).outcomePrices || null, // Polymarket 原始价格数据
          initialPrice: (market as any).initialPrice || null, // 初始价格
          image: (market as any).image || null, // 原始图片 URL
          iconUrl: (market as any).iconUrl || null, // 备份图片字段
          externalId: (market as any).externalId || null, // 外部市场 ID
          // 🔥 别名字段（用于前端兼容）
          originalImage: (market as any).image || null, // 原始图片（别名）
          scrapedImage: (market as any).image || null, // 爬取图片（别名）
          polyOdds: (market as any).outcomePrices || null, // Polymarket 赔率（别名）
          sourceUrl: (market as any).externalId ? `https://polymarket.com/event/${(market as any).externalId}` : null, // 源链接
          // 🔥 兼容字段（向后兼容）
          imageUrl: (market as any).image || (market as any).iconUrl || '',
            // 🔥 添加评论数（如果数据库中有此字段，否则为 0）
            commentsCount: (market as any).commentsCount || 0,
            // 添加详细字段（安全处理 null 值）
            source: marketSource,
            externalVolume,
            internalVolume,
            manualOffset,
          };
        } catch (mapError) {
          console.error('❌ [Markets API] 序列化单个市场失败 (ID:', market.id, '):');
          console.error('错误:', mapError instanceof Error ? mapError.message : String(mapError));
          // 返回一个安全的默认对象，避免整个请求失败
          const totalAmount = (market.totalYes || 0) + (market.totalNo || 0);
          const yesPercent = totalAmount > 0 
            ? Math.round(((market.totalYes || 0) / totalAmount) * 100 * 100) / 100 
            : 50;
          const noPercent = totalAmount > 0 
            ? Math.round(((market.totalNo || 0) / totalAmount) * 100 * 100) / 100 
            : 50;
          const currentPrice = totalAmount > 0 
            ? (market.totalYes || 0) / totalAmount 
            : 0.5;

          return {
            ...market,
            displayVolume: market.totalVolume || 0,
            volume: market.totalVolume || 0,
            volume24h: market.totalVolume || 0,
            yesPercent,
            noPercent,
            currentPrice,
            outcomePrices: market.outcomePrices || null,
            initialPrice: market.initialPrice || null,
            image: market.image || null,
            imageUrl: market.image || market.iconUrl || '',
            iconUrl: market.iconUrl || market.image || '',
            volume24h: market.volume24h || market.totalVolume || 0,
            commentsCount: (market as any).commentsCount || 0,
            source: 'INTERNAL',
            externalVolume: 0,
            internalVolume: 0,
            manualOffset: 0,
          };
        }
        })
        .filter((m): m is NonNullable<typeof m> => m !== null); // 🚀 过滤掉 isActive=false 的市场
      console.log('✅ [Markets API] 序列化完成，共', serializedMarkets.length, '个市场');
    } catch (serializeError) {
      console.error('❌ [Markets API] 序列化市场数据失败:');
      console.error('错误类型:', serializeError instanceof Error ? serializeError.constructor.name : typeof serializeError);
      console.error('错误消息:', serializeError instanceof Error ? serializeError.message : String(serializeError));
      console.error('错误堆栈:', serializeError instanceof Error ? serializeError.stack : 'N/A');
      throw serializeError; // 重新抛出，让外层 catch 处理
    }

    console.log('✅ [Markets API] ========== 市场列表获取成功 ==========');

    const totalPages = Math.ceil(filteredMarkets.length / pageSize);
    const hasMore = page < totalPages;

    // 🚀 强制设置响应头，禁止所有级别的缓存（解决删除后前端仍显示的问题）
    const response = NextResponse.json({
      success: true,
      data: serializedMarkets,
      pagination: {
        total: filteredMarkets.length,
        page,
        pageSize,
        totalPages,
        hasMore, // 🔥 添加 hasMore 字段，用于前端判断是否还有更多数据
      },
    });
    
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    // 捕获异常：打印完整的错误堆栈
    console.error('❌ [Markets API] ========== 获取市场列表失败 ==========');
    console.error('❌ [Markets API] 错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('❌ [Markets API] 错误消息:', error instanceof Error ? error.message : String(error));
    console.error('❌ [Markets API] 完整错误堆栈:');
    if (error instanceof Error) {
      console.error(error.stack);
    } else {
      console.error(error);
    }
    console.error('❌ [Markets API] ===============================');

    // 🔥 错误响应也要禁用缓存
    const errorResponse = NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch markets',
        // 开发环境下返回详细错误信息（生产环境应移除）
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
    
    // 🔥 设置错误响应的缓存头
    errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    errorResponse.headers.set('Pragma', 'no-cache');
    errorResponse.headers.set('Expires', '0');
    
    return errorResponse;
  }
}

