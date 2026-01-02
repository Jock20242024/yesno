import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 🔥 强制 API 实时刷新：禁用静态缓存
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * 翻译映射：数据库中的中文 label -> 英文 label
 */
const labelTranslationMap: Record<string, string> = {
  '进行中事件': 'Active Events',
  '24H 交易量': '24H Trading Volume',
  '24H交易量': '24H Trading Volume', // 无空格版本
  '总锁仓量 (TVL)': 'Total Value Locked (TVL)',
  '总锁仓量(TVL)': 'Total Value Locked (TVL)', // 无空格版本
  '24H 活跃交易者': '24H Active Traders',
  '24H活跃交易者': '24H Active Traders', // 无空格版本
};

/**
 * 翻译 label：将数据库中的中文 label 转换为英文
 */
function translateLabel(label: string, language: string): string {
  // 如果是中文，直接返回原 label
  if (language === 'zh') {
    return label;
  }
  
  // 如果是英文，进行翻译
  // 精确匹配
  if (labelTranslationMap[label]) {
    return labelTranslationMap[label];
  }
  
  // 部分匹配（处理可能的空格或格式差异）
  const normalizedLabel = label.replace(/\s+/g, '');
  for (const [key, translated] of Object.entries(labelTranslationMap)) {
    const normalizedKey = key.replace(/\s+/g, '');
    if (normalizedLabel === normalizedKey || normalizedLabel.includes(normalizedKey) || normalizedKey.includes(normalizedLabel)) {
      return translated;
    }
  }
  
  // 如果没有映射，返回原标签
  return label;
}

/**
 * 获取激活的全局指标（公开 API）
 * GET /api/stats
 * 
 * 返回所有 isActive: true 的指标，按 sortOrder 排序
 * 指标值会从采集源实时计算（如果指标标签匹配）
 * 
 * 查询参数：
 * - lang: 语言代码 (zh|en)，默认为 en
 */
export async function GET(request: NextRequest) {
  try {
    // 🔥 从查询参数或 Accept-Language 头获取语言
    const { searchParams } = new URL(request.url);
    const langParam = searchParams.get('lang');
    const acceptLanguage = request.headers.get('accept-language') || '';
    let language = langParam || (acceptLanguage.includes('zh') ? 'zh' : 'en');
    
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

    // 🔥 翻译 label：将数据库中的中文 label 转换为请求的语言
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

      // 🔥 翻译 label
      const translatedLabel = translateLabel(stat.label, language);

      return {
        id: stat.id,
        label: translatedLabel, // 🔥 返回翻译后的 label
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
    console.error('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('错误消息:', error instanceof Error ? error.message : String(error));
    console.error('错误堆栈:', error instanceof Error ? error.stack : 'N/A');
    
    // 🔥 即使出错也返回空数组，而不是 500 错误
    return NextResponse.json(
      {
        success: true, // 🔥 改为 true，避免前端报错
        data: [], // 🔥 返回空数组
      },
      { status: 200 } // 🔥 改为 200，避免前端报错
    );
  }
}
