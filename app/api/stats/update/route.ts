import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = "force-dynamic";

/**
 * 批量更新全局指标数值（预留接口，用于自动化脚本）
 * POST /api/stats/update
 * 
 * 请求体格式：
 * [
 *   { id: "stat_id", value: 123.45 },
 *   { id: "stat_id_2", value: 678.90 }
 * ]
 * 
 * 或者通过 label 匹配：
 * [
 *   { label: "24H 交易量", value: 123.45 },
 *   { label: "全网持仓量", value: 678.90 }
 * ]
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const updates = Array.isArray(body) ? body : [body];

    const results = [];

    for (const update of updates) {
      const { id, label, value } = update;

      if (value === undefined) {
        results.push({
          success: false,
          error: '缺少 value 字段',
          identifier: id || label,
        });
        continue;
      }

      try {
        let updatedStat;

        if (id) {
          // 通过 ID 更新
          updatedStat = await prisma.global_stats.update({
            where: { id },
            data: { value: parseFloat(value) },
          });
        } else if (label) {
          // 通过 label 更新
          const existingStat = await prisma.global_stats.findFirst({
            where: { label: label.trim() },
          });

          if (!existingStat) {
            results.push({
              success: false,
              error: `未找到 label 为 "${label}" 的指标`,
              identifier: label,
            });
            continue;
          }

          updatedStat = await prisma.global_stats.update({
            where: { id: existingStat.id },
            data: { value: parseFloat(value) },
          });
        } else {
          results.push({
            success: false,
            error: '必须提供 id 或 label',
            identifier: 'unknown',
          });
          continue;
        }

        results.push({
          success: true,
          data: updatedStat,
        });
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message || '更新失败',
          identifier: id || label || 'unknown',
        });
      }
    }

    // 如果有失败的情况，返回部分成功的状态码
    const hasFailures = results.some(r => !r.success);
    const statusCode = hasFailures ? 207 : 200; // 207 Multi-Status

    return NextResponse.json(
      {
        success: !hasFailures,
        results,
      },
      { status: statusCode }
    );
  } catch (error) {
    console.error('批量更新全局指标失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '批量更新全局指标失败',
      },
      { status: 500 }
    );
  }
}
