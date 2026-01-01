import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 🔥 强制 API 实时刷新：禁用静态缓存
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * 获取激活的全局指标（公开 API）
 * GET /api/stats
 * 
 * 返回所有 isActive: true 的指标，按 sortOrder 排序
 * 指标值会从采集源实时计算（如果指标标签匹配）
 */
export async function GET() {
  try {
    // 获取所有激活的全局指标（包含手动覆盖和偏移字段）
    const stats = await prisma.global_stats.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
      select: {
        id: true,
        label: true,
        value: true,
        unit: true,
        icon: true,
        sortOrder: true,
        isActive: true,
        manualOffset: true,
        overrideValue: true,
      },
    });

    // 🔥 简化逻辑：脚本 B 已经直接写入中文标签，API 只需要原样返回 GlobalStat 数据
    const statsWithCalculated = stats.map(stat => {
      // 如果设置了 overrideValue，直接使用 overrideValue，不进行自动计算
      let baseValue = stat.value;
      
      if (stat.overrideValue !== null && stat.overrideValue !== undefined) {
        // 如果设置了手动固定值，直接使用
        baseValue = stat.overrideValue;
      } else {
        // 🔥 直接使用 GlobalStat 表中的值（脚本 B 已计算并更新到中文标签）
        baseValue = stat.value || 0;
      }
      
      // 应用手动偏移量（如果有）
      const finalValue = baseValue + (stat.manualOffset || 0);

      return {
        id: stat.id,
        label: stat.label,
        value: finalValue,
        unit: stat.unit,
        icon: stat.icon,
        sortOrder: stat.sortOrder,
        isActive: stat.isActive,
      };
    });

    return NextResponse.json({
      success: true,
      data: statsWithCalculated,
    });
  } catch (error) {
    console.error('❌ [Stats API] 获取全局指标失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取数据失败',
      },
      { status: 500 }
    );
  }
}
