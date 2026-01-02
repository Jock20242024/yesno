import { NextRequest, NextResponse } from "next/server";
import { DBService } from '@/lib/dbService'; // 修复：使用正确的 DBService，不再使用 mockData
import { verifyAdminToken, createUnauthorizedResponse } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { TransactionStatus } from '@/types/data';

export const dynamic = 'force-dynamic';

/**
 * 管理后台 - 财务数据汇总 API
 * GET /api/admin/finance/summary
 * 
 * 查询参数：
 * - startDate?: string;  // 开始日期 (ISO 8601 格式)
 * - endDate?: string;    // 结束日期 (ISO 8601 格式)
 */
export async function GET(request: NextRequest) {
  try {
    // 权限校验：使用统一的 Admin Token 验证函数（从 Cookie 读取）
    const authResult = await verifyAdminToken(request);

    if (!authResult.success) {
      return createUnauthorizedResponse(
        authResult.error || 'Unauthorized. Admin access required.',
        authResult.statusCode || 401
      );
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    // 解析日期参数
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (startDateParam) {
      startDate = new Date(startDateParam);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid startDate format. Please use ISO 8601 format (e.g., "2024-01-01T00:00:00Z")',
          },
          { status: 400 }
        );
      }
    }

    if (endDateParam) {
      endDate = new Date(endDateParam);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid endDate format. Please use ISO 8601 format (e.g., "2024-12-31T23:59:59Z")',
          },
          { status: 400 }
        );
      }
    }

    // 修复：从数据库查询所有充值记录（管理员可以查看所有用户的充值）
    const depositWhere: any = {
      status: TransactionStatus.COMPLETED, // 只统计已完成的充值
    };
    if (startDate || endDate) {
      depositWhere.createdAt = {};
      if (startDate) depositWhere.createdAt.gte = startDate;
      if (endDate) depositWhere.createdAt.lte = endDate;
    }

    // 修复：从数据库查询所有提现记录（管理员可以查看所有用户的提现）
    const withdrawalWhere: any = {
      status: { in: [TransactionStatus.COMPLETED] }, // 只统计已完成的提现（TransactionStatus 枚举只有 PENDING, COMPLETED, FAILED）
    };
    if (startDate || endDate) {
      withdrawalWhere.createdAt = {};
      if (startDate) withdrawalWhere.createdAt.gte = startDate;
      if (endDate) withdrawalWhere.createdAt.lte = endDate;
    }

    const [completedDeposits, completedWithdrawals] = await Promise.all([
      prisma.deposits.findMany({
        where: depositWhere,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.withdrawals.findMany({
        where: withdrawalWhere,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // 计算总充值金额
    const totalDeposits = completedDeposits.reduce((sum, deposit) => sum + Number(deposit.amount), 0);

    // 计算总提现金额
    const totalWithdrawals = completedWithdrawals.reduce((sum, withdrawal) => sum + Number(withdrawal.amount), 0);

    // 计算净流入
    const netFlow = totalDeposits - totalWithdrawals;

    // 模拟手续费收入（假设从交易中收取 2.5% 的手续费）
    // 这里简化计算：手续费 = 总充值 * 2.5%
    const feesCollected = totalDeposits * 0.025;

    // 生成趋势数据（按月）
    const trendData = generateTrendData(completedDeposits, completedWithdrawals, startDate, endDate);

    return NextResponse.json({
      success: true,
      data: {
        totalDeposits: parseFloat(totalDeposits.toFixed(2)),
        totalWithdrawals: parseFloat(totalWithdrawals.toFixed(2)),
        netFlow: parseFloat(netFlow.toFixed(2)),
        feesCollected: parseFloat(feesCollected.toFixed(2)),
        trendData,
      },
    });
  } catch (error) {
    console.error("Admin finance summary API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * 生成趋势数据（按月）
 */
function generateTrendData(
  deposits: Array<{ amount: number; createdAt: Date }>,
  withdrawals: Array<{ amount: number; createdAt: Date }>,
  startDate: Date | null,
  endDate: Date | null
) {
  // 确定时间范围
  const now = new Date();
  const defaultStartDate = startDate || new Date(now.getFullYear(), now.getMonth() - 5, 1); // 默认最近6个月
  const defaultEndDate = endDate || now;

  // 按月分组数据
  const monthlyData: Record<string, { deposits: number; withdrawals: number; month: string }> = {};

  // 处理充值数据
  deposits.forEach((deposit) => {
    const date = deposit.createdAt instanceof Date ? deposit.createdAt : new Date(deposit.createdAt);
    if (date >= defaultStartDate && date <= defaultEndDate) {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          deposits: 0,
          withdrawals: 0,
          month: monthKey,
        };
      }
      monthlyData[monthKey].deposits += Number(deposit.amount);
    }
  });

  // 处理提现数据
  withdrawals.forEach((withdrawal) => {
    const date = withdrawal.createdAt instanceof Date ? withdrawal.createdAt : new Date(withdrawal.createdAt);
    if (date >= defaultStartDate && date <= defaultEndDate) {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          deposits: 0,
          withdrawals: 0,
          month: monthKey,
        };
      }
      monthlyData[monthKey].withdrawals += Number(withdrawal.amount);
    }
  });

  // 转换为数组并按月份排序
  const trendArray = Object.values(monthlyData)
    .map((item) => ({
      month: item.month,
      deposits: parseFloat(item.deposits.toFixed(2)),
      withdrawals: parseFloat(item.withdrawals.toFixed(2)),
      netFlow: parseFloat((item.deposits - item.withdrawals).toFixed(2)),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return trendArray;
}

