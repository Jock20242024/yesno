import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/authExport";
import { prisma } from "@/lib/prisma";
import { TransactionStatus, MarketStatus } from "@/types/data";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 管理后台 - Dashboard 统计数据 API
 * GET /api/admin/dashboard/stats
 * 
 * 查询参数：
 * - timeRange: 日期范围（仅用于趋势图表：7d, 30d, 90d, all）
 */
export async function GET(request: NextRequest) {
  try {
    // 🔥 修复：同时支持 NextAuth session 和 adminToken cookie 验证
    let isAdmin = false;
    let currentUserId: string | null = null;
    
    // 方案 1：检查 NextAuth session
    try {
      const session = await auth();
      if (session && session.user) {
        isAdmin = (session.user as any).isAdmin === true || (session.user as any).role === 'ADMIN';
        if (isAdmin) {
          currentUserId = session.user.id || (session.user as any).sub;
        }
      }
    } catch (authError) {
      console.error('❌ [Admin Dashboard Stats] NextAuth 验证失败:', authError);
    }
    
    // 方案 2：如果没有 NextAuth session，检查 adminToken cookie
    if (!isAdmin) {
      try {
        const { verifyAdminToken } = await import('@/lib/adminAuth');
        const authResult = await verifyAdminToken(request);
        if (authResult.success) {
          isAdmin = true;
          currentUserId = authResult.userId || null;
        }
      } catch (tokenError) {
        console.error('❌ [Admin Dashboard Stats] AdminToken 验证失败:', tokenError);
      }
    }
    
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Admin access required." },
        { status: 401 }
      );
    }

    // 获取查询参数（仅用于趋势图表的时间范围）
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d'; // 默认30天

    // 计算趋势图表的日期范围
    const now = new Date();
    let trendStartDate: Date | null = null;
    
    if (timeRange === '7d') {
      trendStartDate = new Date(now);
      trendStartDate.setDate(trendStartDate.getDate() - 7);
    } else if (timeRange === '30d') {
      trendStartDate = new Date(now);
      trendStartDate.setDate(trendStartDate.getDate() - 30);
    } else if (timeRange === '90d') {
      trendStartDate = new Date(now);
      trendStartDate.setDate(trendStartDate.getDate() - 90);
    }

    // 获取今日开始和结束时间
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 获取24小时前的时间（用于活跃用户统计）
    const last24Hours = new Date(now);
    last24Hours.setHours(last24Hours.getHours() - 24);

    // 获取本周开始时间（周一开始）
    const thisWeekStart = new Date(today);
    const dayOfWeek = today.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    thisWeekStart.setDate(today.getDate() - daysFromMonday);

    // 获取本月开始时间
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // 🔥 数据库连接检查：确保 Prisma 引擎已连接
    try {
      await prisma.$connect();
    } catch (dbError: any) {
      console.error('❌ [Admin Dashboard Stats] 数据库连接失败:', dbError);
      // 如果是连接错误，尝试重新连接
      if (dbError.message?.includes('Response from the Engine was empty') || 
          dbError.message?.includes('Engine is not yet connected')) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          await prisma.$connect();
        } catch (retryError) {
          console.error('❌ [Admin Dashboard Stats] 重试连接失败:', retryError);
          return NextResponse.json({
            success: false,
            error: 'Database connection failed',
          }, { status: 503 });
        }
      } else {
        return NextResponse.json({
          success: false,
          error: 'Database connection failed',
        }, { status: 503 });
      }
    }

    // ========== 一、实时状态指标（不需要时间范围） ==========
    let totalUsers = 0;
    let activeUsers24h = 0;
    let activeMarkets = 0;
    let pendingWithdrawals = 0;
    let pendingReviewMarkets = 0;
    let activeTemplates = 0;
    let pausedTemplates: any[] = [];
    let runningTemplatesCount = 0;
    
    try {
      const [
        totalUsersResult,
        activeUsers24hResult,
        activeMarketsResult,
        pendingWithdrawalsResult,
        pendingReviewMarketsResult,
        activeTemplatesResult,
        pausedTemplatesResult,
        runningTemplatesCountResult,
      ] = await Promise.all([
      // 1. 总注册用户数（累计）
      prisma.users.count(),

      // 2. 活跃用户数（24小时内登录或下单的用户）
      prisma.users.count({
        where: {
          OR: [
            {
              orders: {
                some: {
                  createdAt: {
                    gte: last24Hours,
                  },
                },
              },
            },
            {
              updatedAt: {
                gte: last24Hours,
              },
            },
          ],
        },
      }),

      // 3. 活跃市场数（当前状态）- 🔥 使用简单计数避免聚合函数错误
      prisma.markets.count({
        where: {
          status: MarketStatus.OPEN,
          reviewStatus: 'PUBLISHED',
          isActive: true,
        },
      }),

      // 4. 待处理提现（当前状态）
      prisma.withdrawals.count({
        where: {
          status: TransactionStatus.PENDING,
        },
      }),

      // 5. 待审核事件数（当前状态）
      prisma.markets.count({
        where: {
          reviewStatus: 'PENDING',
          isActive: true,
        },
      }),

      // 6. 已上架交易的模版数（统计已经生成市场且有实际交易的模版）
      // 业务逻辑：不是统计模版配置，而是统计已经生成市场且有实际交易的模版
      // 查找所有 isFactory: true 且有关联订单（有交易）的市场，统计不同的 templateId 数量
      (async () => {
        // 查找所有工厂生成的市场，这些市场有订单（有交易）
        const marketsWithTrades = await prisma.markets.findMany({
          where: {
            isFactory: true,
            templateId: { not: null },
            orders: {
              some: {}, // 至少有一个订单（有交易）
            },
            isActive: true,
          },
          select: {
            templateId: true,
          },
        });
        
        // 统计不同的 templateId 数量（去重）
        const uniqueTemplateIds = new Set(
          marketsWithTrades
            .map(m => m.templateId)
            .filter((id): id is string => id !== null)
        );
        
        return uniqueTemplateIds.size;
      })(),

      // 7. 异常熔断模版数及详情（当前状态）
      prisma.market_templates.findMany({
        where: {
          status: 'PAUSED',
        },
        select: {
          id: true,
          name: true,
          symbol: true,
          period: true,
          pauseReason: true,
          failureCount: true,
          updatedAt: true,
        },
      }),

      // 7.5. 自动化工厂运行状态：检查是否有运行中的模版
      prisma.market_templates.count({
        where: {
          isActive: true,
          status: 'ACTIVE',
        },
      }),
      ]);
      
      totalUsers = totalUsersResult;
      activeUsers24h = activeUsers24hResult;
      activeMarkets = activeMarketsResult;
      pendingWithdrawals = pendingWithdrawalsResult;
      pendingReviewMarkets = pendingReviewMarketsResult;
      activeTemplates = activeTemplatesResult;
      pausedTemplates = pausedTemplatesResult;
      runningTemplatesCount = runningTemplatesCountResult;
    } catch (dbError: any) {
      console.error('❌ [Admin Dashboard Stats] 数据库查询失败:', dbError);
      // 继续执行，使用默认值
    }

    // ========== 二、今日指标（固定今日） ==========
    let todayNewUsers = 0;
    let todayVolume = { _sum: { amount: null as number | null } };
    let todayOrders = 0;
    let todayFeeRevenue = { _sum: { feeDeducted: null as number | null } };
    let todayMarkets = 0;
    
    try {
      const [
        todayNewUsersResult,
        todayVolumeResult,
        todayOrdersResult,
        todayFeeRevenueResult,
        todayMarketsResult,
      ] = await Promise.all([
      // 1. 今日新增注册用户
      prisma.users.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),

      // 2. 今日交易量（本平台产生的）
      prisma.orders.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),

      // 3. 今日订单数
      prisma.orders.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),

      // 4. 今日手续费收入
      prisma.orders.aggregate({
        _sum: {
          feeDeducted: true,
        },
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),

      // 5. 今日生成盘口数（工厂）
      prisma.markets.count({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
          isFactory: true,
        },
      }),
      ]);
      
      todayNewUsers = todayNewUsersResult;
      todayVolume = todayVolumeResult;
      todayOrders = todayOrdersResult;
      todayFeeRevenue = todayFeeRevenueResult;
      todayMarkets = todayMarketsResult;
    } catch (dbError: any) {
      console.error('❌ [Admin Dashboard Stats] 今日指标查询失败:', dbError);
      // 继续执行，使用默认值
    }

    // ========== 三、本周指标（用于对比） ==========
    let weekVolume = { _sum: { amount: null as number | null } };
    let weekNewUsers = 0;
    let weekOrders = 0;
    let weekFeeRevenue = { _sum: { feeDeducted: null as number | null } };
    
    try {
      const [
        weekVolumeResult,
        weekNewUsersResult,
        weekOrdersResult,
        weekFeeRevenueResult,
      ] = await Promise.all([
      // 1. 本周交易量
      prisma.orders.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          createdAt: {
            gte: thisWeekStart,
          },
        },
      }),

      // 2. 本周新增用户
      prisma.users.count({
        where: {
          createdAt: {
            gte: thisWeekStart,
          },
        },
      }),

      // 3. 本周订单数
      prisma.orders.count({
        where: {
          createdAt: {
            gte: thisWeekStart,
          },
        },
      }),

      // 4. 本周手续费收入
      prisma.orders.aggregate({
        _sum: {
          feeDeducted: true,
        },
        where: {
          createdAt: {
            gte: thisWeekStart,
          },
        },
      }),
      ]);
      
      weekVolume = weekVolumeResult;
      weekNewUsers = weekNewUsersResult;
      weekOrders = weekOrdersResult;
      weekFeeRevenue = weekFeeRevenueResult;
    } catch (dbError: any) {
      console.error('❌ [Admin Dashboard Stats] 本周指标查询失败:', dbError);
      // 继续执行，使用默认值
    }

    // ========== 四、累计总交易量（本平台产生的） ==========
    let totalVolumeResult = { _sum: { internalVolume: null as number | null } };
    try {
      totalVolumeResult = await prisma.markets.aggregate({
        _sum: {
          internalVolume: true,
        },
        where: {
          isActive: true,
        },
      });
    } catch (dbError: any) {
      console.error('❌ [Admin Dashboard Stats] 累计交易量查询失败:', dbError);
      // 继续执行，使用默认值
    }

    // ========== 五、赔率机器人运行状态 ==========
    let oddsRobotStatus = {
      status: 'INACTIVE' as 'ACTIVE' | 'INACTIVE' | 'ERROR',
      lastPulse: null as string | null,
      activePoolSize: 0,
      syncEfficiency: 0,
      errorMessage: null as string | null,
    };

    try {
      // 查询赔率机器人状态
      const robotTask = await prisma.scraper_tasks.findUnique({
        where: { name: 'OddsRobot' },
        select: {
          status: true,
          lastRunTime: true,
          message: true,
        },
      });

      const activePoolSize = await prisma.markets.count({
        where: {
          source: 'POLYMARKET',
          isActive: true,
          status: MarketStatus.OPEN,
        },
      });

      oddsRobotStatus = {
        status: robotTask?.status === 'NORMAL' ? 'ACTIVE' : robotTask?.status === 'ABNORMAL' ? 'ERROR' : 'INACTIVE',
        lastPulse: robotTask?.lastRunTime?.toISOString() || null,
        activePoolSize,
        syncEfficiency: 0,
        errorMessage: null,
      };

      // 解析 message 获取同步效能
      if (robotTask?.message) {
        try {
          const messageData = JSON.parse(robotTask.message);
          if (typeof messageData === 'object' && messageData !== null) {
            const checkedCount = messageData.checkedCount || 0;
            const queuedCount = messageData.queuedCount || 0;
            if (checkedCount > 0) {
              oddsRobotStatus.syncEfficiency = Math.round((queuedCount / checkedCount) * 100);
            }
            if (messageData.error) {
              oddsRobotStatus.errorMessage = messageData.error;
            }
          }
        } catch (e) {
          if (robotTask.status === 'ABNORMAL') {
            oddsRobotStatus.errorMessage = robotTask.message;
          }
        }
      }
    } catch (error) {
      console.error('获取赔率机器人状态失败:', error);
    }

    // ========== 六、趋势图表数据（可选时间范围） ==========
    let volumeHistory: Array<{ date: string; value: number }> = [];
    let activeUsersHistory: Array<{ date: string; value: number }> = [];
    let orderHistory: Array<{ date: string; value: number }> = [];

    if (trendStartDate) {
      try {
        // 1. 交易量趋势（按日期分组，统计订单金额）
        const orders = await prisma.orders.findMany({
          where: {
            createdAt: {
              gte: trendStartDate,
            },
          },
          select: {
            amount: true,
            createdAt: true,
          },
        });

        const dailyVolumeData: Record<string, number> = {};
        orders.forEach(order => {
          const date = new Date(order.createdAt).toISOString().split('T')[0];
          dailyVolumeData[date] = (dailyVolumeData[date] || 0) + Number(order.amount || 0);
        });

        volumeHistory = Object.entries(dailyVolumeData)
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // 2. 活跃用户趋势（按日期分组，统计每天有下单的唯一用户数）
        const ordersWithUsers = await prisma.orders.findMany({
          where: {
            createdAt: {
              gte: trendStartDate,
            },
          },
          select: {
            userId: true,
            createdAt: true,
          },
        });

        const dailyActiveUserData: Record<string, Set<string>> = {};
        ordersWithUsers.forEach(order => {
          const date = new Date(order.createdAt).toISOString().split('T')[0];
          if (!dailyActiveUserData[date]) dailyActiveUserData[date] = new Set();
          dailyActiveUserData[date].add(order.userId);
        });

        activeUsersHistory = Object.entries(dailyActiveUserData)
          .map(([date, userIds]) => ({ date, value: userIds.size }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // 3. 订单数趋势
        const dailyOrderData: Record<string, number> = {};
        orders.forEach(order => {
          const date = new Date(order.createdAt).toISOString().split('T')[0];
          dailyOrderData[date] = (dailyOrderData[date] || 0) + 1;
        });

        orderHistory = Object.entries(dailyOrderData)
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => a.date.localeCompare(b.date));
      } catch (trendError: any) {
        console.error('❌ [Admin Dashboard Stats] 趋势数据查询失败:', trendError);
        // 继续执行，使用空数组
      }
    }

    // ========== 计算结果 ==========
    const totalVolume = Number(totalVolumeResult._sum?.internalVolume) || 0;
    const todayVolumeValue = Number(todayVolume._sum?.amount) || 0;
    const todayFeeRevenueValue = Number(todayFeeRevenue._sum?.feeDeducted) || 0;
    const weekVolumeValue = Number(weekVolume._sum?.amount) || 0;
    const weekFeeRevenueValue = Number(weekFeeRevenue._sum?.feeDeducted) || 0;
    
    // 计算运营指标
    const avgOrderAmount = todayOrders > 0 ? todayVolumeValue / todayOrders : 0;
    const activeUserRate = totalUsers > 0 ? (activeUsers24h / totalUsers) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        // 实时状态指标
        totalUsers,
        activeUsers24h,
        activeMarkets,
        pendingWithdrawals,
        pendingReviewMarkets,
        activeTemplates, // 已上架交易模版数
        pausedTemplates: pausedTemplates.length, // 异常熔断模版数
        pausedTemplatesDetails: pausedTemplates.map(t => ({
          id: t.id,
          name: t.name,
          symbol: t.symbol,
          period: t.period,
          pauseReason: t.pauseReason,
          failureCount: t.failureCount,
          updatedAt: t.updatedAt.toISOString(), // 转换为字符串
        })), // 异常熔断模版详情
        factoryStatus: runningTemplatesCount > 0 ? 'RUNNING' : 'STOPPED', // 工厂运行状态：如果有运行中的模版就是运行中，否则是停止
        oddsRobotStatus, // 赔率机器人运行状态

        // 今日指标
        todayNewUsers,
        todayVolume: parseFloat(todayVolumeValue.toFixed(2)),
        todayOrders,
        todayFeeRevenue: parseFloat(todayFeeRevenueValue.toFixed(2)),
        todayMarkets,

        // 本周指标
        weekVolume: parseFloat(weekVolumeValue.toFixed(2)),
        weekNewUsers,
        weekOrders,
        weekFeeRevenue: parseFloat(weekFeeRevenueValue.toFixed(2)),

        // 累计指标
        totalVolume: parseFloat(totalVolume.toFixed(2)),

        // 运营指标
        avgOrderAmount: parseFloat(avgOrderAmount.toFixed(2)),
        activeUserRate: parseFloat(activeUserRate.toFixed(2)),

        // 趋势数据（可选时间范围）
        volumeHistory,
        activeUsersHistory,
        orderHistory,
        timeRange,
      },
    });
  } catch (error: any) {
    console.error("❌ [Admin Dashboard Stats API] 错误:", error);
    console.error("❌ [Admin Dashboard Stats API] 错误堆栈:", error?.stack);
    return NextResponse.json(
      {
        success: false,
        error: "获取统计数据失败",
        message: error?.message || "Internal server error",
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
