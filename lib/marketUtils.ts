/**
 * 市场工具函数
 * 提供市场相关的计算和转换逻辑
 */

import { MarketSource } from '@prisma/client';

/**
 * 计算展示交易量
 * 
 * 根据市场来源（source）自动计算展示交易量：
 * - POLYMARKET: displayVolume = externalVolume + internalVolume + manualOffset
 * - INTERNAL: displayVolume = internalVolume + manualOffset
 * 
 * @param source 市场来源（POLYMARKET 或 INTERNAL）
 * @param externalVolume 外部交易量（从爬虫获取）
 * @param internalVolume 内部交易量（平台产生的）
 * @param manualOffset 手动偏移量（后台可调整）
 * @returns 展示交易量
 */
export function getDisplayVolume(
  source: MarketSource | null | undefined,
  externalVolume: number | bigint | null | undefined = 0,
  internalVolume: number | bigint | null | undefined = 0,
  manualOffset: number | bigint | null | undefined = 0
): number {
  // 🔥 处理 BigInt 类型：如果是 BigInt，先转换为 Number
  const convertToSafeNumber = (value: any): number => {
    if (value === null || value === undefined) return 0;
    // 处理 BigInt 类型
    if (typeof value === 'bigint') {
      try {
        return Number(value);
      } catch {
        return 0;
      }
    }
    // 处理字符串
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    // 处理数字
    const num = Number(value);
    return isNaN(num) || !isFinite(num) ? 0 : num;
  };

  // 🔥 确保所有参数都是安全的数字，处理 null/undefined/NaN/BigInt
  const safeExtVol = convertToSafeNumber(externalVolume);
  const safeIntVol = convertToSafeNumber(internalVolume);
  const safeOffset = convertToSafeNumber(manualOffset);

  // 🔥 安全处理 source：如果为 null/undefined，默认使用 INTERNAL
  const safeSource = source || 'INTERNAL';

  let result: number;
  if (safeSource === 'POLYMARKET') {
    // Polymarket 事件：展示量 = 外部量 + 内部量 + 手动偏移
    result = safeExtVol + safeIntVol + safeOffset;
  } else {
    // 内部事件：展示量 = 内部量 + 手动偏移（不包含外部量）
    result = safeIntVol + safeOffset;
  }

  // 🔥 最终验证：确保返回值是有效数字，不是 NaN 或 Infinity
  if (!isFinite(result) || isNaN(result)) {
    console.warn(`⚠️ [marketUtils] getDisplayVolume 计算结果无效，返回 0。参数:`, {
      source: safeSource,
      externalVolume,
      internalVolume,
      manualOffset,
      calculated: result,
      safeValues: { safeExtVol, safeIntVol, safeOffset },
    });
    return 0;
  }

  return result;
}

/**
 * 从 Market 对象计算展示交易量（便捷函数）
 * 
 * @param market Market 对象（包含 source, externalVolume, internalVolume, manualOffset）
 * @returns 展示交易量
 */
export function calculateDisplayVolume(market: {
  source?: MarketSource | null;
  externalVolume?: number | null;
  internalVolume?: number | null;
  manualOffset?: number | null;
}): number {
  // 🔥 安全处理 source：如果为 null/undefined，默认使用 INTERNAL
  const safeSource = market.source || 'INTERNAL';
  
  return getDisplayVolume(
    safeSource,
    market.externalVolume ?? 0,
    market.internalVolume ?? 0,
    market.manualOffset ?? 0
  );
}
