/**
 * 格式化金额为 USD 格式
 * @param amount 金额（数字或字符串）
 * @returns 格式化后的字符串，如 "$1,234.56"
 */
export function formatUSD(amount: number | string): string {
  // 🔥 修复：确保在调用 replace 之前先转换为字符串
  const num = typeof amount === "string" ? parseFloat(String(amount || '').replace(/[$,]/g, "")) : Number(amount || 0);
  if (isNaN(num)) return "$0.00";
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * 格式化货币（安全处理字符串和数字）
 * 用于格式化交易量、余额等货币相关数值
 * 
 * @param value 输入值（可以是字符串如 "$1,234.56" 或数字）
 * @param options 格式化选项
 * @returns 格式化后的字符串，如 "$1,234.56" 或 "$1.2k" 或 "$1.5m"
 */
export function formatCurrency(
  value: number | string | null | undefined,
  options?: {
    compact?: boolean; // 是否使用紧凑格式（如 $1.2k, $1.5m）
    decimals?: number; // 小数位数（默认 2）
    showDecimals?: boolean; // 是否显示小数（默认 true）
  }
): string {
  // 安全处理：确保输入不是 null 或 undefined
  if (value === null || value === undefined) {
    return "$0.00";
  }

  // 安全处理：将字符串转换为数字
  let num: number;
  if (typeof value === "string") {
    // 🔥 修复：确保在调用 replace 之前先转换为字符串
    const cleaned = String(value || '').replace(/[$,]/g, "").trim();
    num = parseFloat(cleaned);
  } else {
    num = Number(value || 0);
  }

  // 验证是否为有效数字
  if (isNaN(num) || num < 0) {
    return "$0.00";
  }

  const { compact = false, decimals = 2, showDecimals = true } = options || {};

  // 紧凑格式（用于交易量等大数值）
  if (compact) {
    if (num >= 1000000) {
      const millions = num / 1000000;
      return showDecimals 
        ? `$${millions.toFixed(decimals)}m`
        : `$${Math.round(millions)}m`;
    } else if (num >= 1000) {
      const thousands = num / 1000;
      return showDecimals
        ? `$${thousands.toFixed(decimals)}k`
        : `$${Math.round(thousands)}k`;
    }
  }

  // 标准格式
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: showDecimals ? decimals : 0,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * 将美分价格转换为美元格式
 * @param cents 美分价格字符串，如 "0.65¢" 或 "65¢"
 * @returns 美元格式字符串，如 "$0.65"
 */
export function centsToUSD(cents: string): string {
  // 🔥 修复：确保在调用 replace 之前先转换为字符串
  const cleaned = String(cents || '').replace(/[¢\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "$0.00";
  
  // 如果数字 >= 1，说明已经是美元单位，否则是美分
  const dollars = num >= 1 ? num : num / 100;
  return formatUSD(dollars);
}

/**
 * 浮点数精度处理：将美元金额转换为整数（分）进行计算，避免浮点数精度问题
 * @param dollars 美元金额
 * @returns 美分（整数）
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * 浮点数精度处理：将美分（整数）转换回美元金额
 * @param cents 美分（整数）
 * @returns 美元金额
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * 高精度金额计算：加法
 * @param a 第一个金额（美元）
 * @param b 第二个金额（美元）
 * @returns 结果（美元）
 */
export function preciseAdd(a: number, b: number): number {
  return centsToDollars(dollarsToCents(a) + dollarsToCents(b));
}

/**
 * 高精度金额计算：减法
 * @param a 第一个金额（美元）
 * @param b 第二个金额（美元）
 * @returns 结果（美元）
 */
export function preciseSubtract(a: number, b: number): number {
  return centsToDollars(dollarsToCents(a) - dollarsToCents(b));
}

/**
 * 高精度金额计算：乘法
 * @param amount 金额（美元）
 * @param multiplier 乘数
 * @returns 结果（美元）
 */
export function preciseMultiply(amount: number, multiplier: number): number {
  return centsToDollars(Math.round(dollarsToCents(amount) * multiplier));
}

/**
 * 高精度金额计算：除法
 * @param amount 金额（美元）
 * @param divisor 除数
 * @returns 结果（美元）
 */
export function preciseDivide(amount: number, divisor: number): number {
  if (divisor === 0) return 0;
  return centsToDollars(Math.round(dollarsToCents(amount) / divisor));
}
