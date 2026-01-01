/**
 * 手续费收入统计 API
 * GET /api/admin/fees/income
 * 
 * 查询参数：
 * - timeRange?: 'day' | 'week' | 'month'  // 时间范围（用于趋势图）
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/authExport';
import { prisma } from '@/lib/prisma';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(utc);
dayjs.extend(isoWeek);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 权限校验
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com';
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || 'month'; // day | week | month

    const nowUtc = dayjs.utc();
    
    // 🚀 1. 累计总收入：所有订单的手续费总和
    const totalIncomeResult = await prisma.orders.aggregate({
      _sum: {
        feeDeducted: true,
      },
    });
    const totalIncome = totalIncomeResult._sum.feeDeducted || 0;

    // 🚀 2. 今日收入：今天UTC日期的订单手续费总和
    const todayStart = nowUtc.startOf('day').toDate();
    const todayEnd = nowUtc.endOf('day').toDate();
    
    const todayIncomeResult = await prisma.orders.aggregate({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      _sum: {
        feeDeducted: true,
      },
    });
    const todayIncome = todayIncomeResult._sum.feeDeducted || 0;

    // 🚀 3. 昨日收入：用于计算今日收入较昨日的增长率
    const yesterdayStart = nowUtc.subtract(1, 'day').startOf('day').toDate();
    const yesterdayEnd = nowUtc.subtract(1, 'day').endOf('day').toDate();
    
    const yesterdayIncomeResult = await prisma.orders.aggregate({
      where: {
        createdAt: {
          gte: yesterdayStart,
          lte: yesterdayEnd,
        },
      },
      _sum: {
        feeDeducted: true,
      },
    });
    const yesterdayIncome = yesterdayIncomeResult._sum.feeDeducted || 0;

    // 🚀 4. 计算增长率
    // 今日收入较昨日的增长率
    const todayGrowthPercent = yesterdayIncome > 0 
      ? ((todayIncome - yesterdayIncome) / yesterdayIncome) * 100 
      : (todayIncome > 0 ? 100 : 0);
    
    // 累计总收入较上期的增长率（上期 = 昨天及之前的所有收入）
    // 增长率 = (今日收入 / 历史总收入) * 100，表示今日收入在历史总收入中的占比
    const previousPeriodIncome = totalIncome - todayIncome;
    const totalGrowthPercent = previousPeriodIncome > 0
      ? ((todayIncome / previousPeriodIncome) * 100)
      : (totalIncome > 0 && todayIncome > 0 ? 100 : 0);

    // 🚀 6. 趋势图数据：按时间范围分组统计
    let trendData: Array<{ date: string; income: number }> = [];
    
    if (timeRange === 'day') {
      // 按日统计：最近30天
      const startDate = nowUtc.subtract(29, 'day').startOf('day').toDate();
      
      // 查询所有订单，按日期分组
      const orders = await prisma.orders.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        select: {
          feeDeducted: true,
          createdAt: true,
        },
      });

      // 按日期分组并累加手续费
      const dailyMap = new Map<string, number>();
      orders.forEach(order => {
        const dateKey = dayjs.utc(order.createdAt).format('YYYY-MM-DD');
        const current = dailyMap.get(dateKey) || 0;
        dailyMap.set(dateKey, current + (order.feeDeducted || 0));
      });

      // 转换为数组并按日期排序
      trendData = Array.from(dailyMap.entries())
        .map(([date, income]) => ({ date, income }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } else if (timeRange === 'week') {
      // 按周统计：最近12周（ISO周，从周一开始）
      const startDate = nowUtc.subtract(11, 'week').startOf('isoWeek').toDate();
      
      const orders = await prisma.orders.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        select: {
          feeDeducted: true,
          createdAt: true,
        },
      });

      // 按周分组（使用周的开始日期作为key，格式：YYYY-MM-DD）
      const weeklyMap = new Map<string, number>();
      orders.forEach(order => {
        const orderDate = dayjs.utc(order.createdAt);
        const weekStart = orderDate.startOf('week');
        const weekKey = weekStart.format('YYYY-MM-DD'); // 使用周的开始日期
        const current = weeklyMap.get(weekKey) || 0;
        weeklyMap.set(weekKey, current + (order.feeDeducted || 0));
      });

      trendData = Array.from(weeklyMap.entries())
        .map(([date, income]) => ({ date, income }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } else if (timeRange === 'month') {
      // 按月统计：最近12个月
      const startDate = nowUtc.subtract(11, 'month').startOf('month').toDate();
      
      const orders = await prisma.orders.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        select: {
          feeDeducted: true,
          createdAt: true,
        },
      });

      // 按月分组（格式：YYYY-MM）
      const monthlyMap = new Map<string, number>();
      orders.forEach(order => {
        const monthKey = dayjs.utc(order.createdAt).format('YYYY-MM');
        const current = monthlyMap.get(monthKey) || 0;
        monthlyMap.set(monthKey, current + (order.feeDeducted || 0));
      });

      trendData = Array.from(monthlyMap.entries())
        .map(([date, income]) => ({ date, income }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    return NextResponse.json({
      success: true,
      data: {
        totalIncome: Number(totalIncome),
        todayIncome: Number(todayIncome),
        yesterdayIncome: Number(yesterdayIncome),
        todayGrowthPercent: Number(todayGrowthPercent.toFixed(2)),
        totalGrowthPercent: Number(totalGrowthPercent.toFixed(2)),
        trendData,
        timeRange,
      },
    });
  } catch (error: any) {
    console.error('❌ [Fee Income API] 获取手续费收入失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
