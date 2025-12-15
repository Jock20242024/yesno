/**
 * 格式化金额为 USD 格式
 * @param amount 金额（数字或字符串）
 * @returns 格式化后的字符串，如 "$1,234.56"
 */
export function formatUSD(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount.replace(/[$,]/g, "")) : amount;
  if (isNaN(num)) return "$0.00";
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * 将美分价格转换为美元格式
 * @param cents 美分价格字符串，如 "0.65¢" 或 "65¢"
 * @returns 美元格式字符串，如 "$0.65"
 */
export function centsToUSD(cents: string): string {
  // 移除 ¢ 符号和可能的空格
  const cleaned = cents.replace(/[¢\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "$0.00";
  
  // 如果数字 >= 1，说明已经是美元单位，否则是美分
  const dollars = num >= 1 ? num : num / 100;
  return formatUSD(dollars);
}

