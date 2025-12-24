/**
 * 🔥 市场图标工具函数
 * 根据市场类型动态匹配图标
 */

import {
  Bitcoin,
  Building2,
  Flag,
  Rocket,
  Bot,
  Coins,
  Mic,
  Globe,
  Activity,
  Film,
  LucideIcon,
  Trophy,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Bitcoin,
  Building2,
  Flag,
  Rocket,
  Bot,
  Coins,
  Mic,
  Globe,
  Activity,
  Film,
  Trophy,
};

/**
 * 🔥 根据市场信息动态匹配图标
 * 
 * @param market - 市场对象，可能包含 templateId, symbol, asset, category, categorySlug 等信息
 * @returns 图标名称（用于 iconMap 查找）
 */
export function getMarketIcon(market: any): string {
  // 1. 如果是工厂市场（有 templateId），根据 symbol/asset 或标题匹配
  if (market.templateId || market.isFactory) {
    // 优先使用 symbol/asset 字段
    const symbol = (market.symbol || market.asset || '').toUpperCase();
    const title = (market.title || '').toUpperCase();
    
    // 检查 symbol 或标题中是否包含币种
    if (symbol.includes('BTC') || title.includes('BTC') || title.includes('比特币') || title.includes('BITCOIN')) {
      return 'Bitcoin'; // BTC -> 橙色B
    }
    if (symbol.includes('ETH') || title.includes('ETH') || title.includes('以太坊') || title.includes('ETHEREUM')) {
      return 'Coins'; // ETH -> 蓝色菱形（使用 Coins 图标）
    }
    // 其他币种可以根据需要扩展
    
    // 默认工厂市场图标
    return 'Coins'; // 默认使用 Coins 而不是 Bitcoin
  }
  
  // 2. 如果是独立市场，根据分类匹配
  const categorySlug = (market.categorySlug || '').toLowerCase();
  const category = (market.category || '').toLowerCase();
  
  // 政治 -> 建筑
  if (categorySlug.includes('politic') || category.includes('政治')) {
    return 'Building2';
  }
  
  // 体育 -> 奖杯
  if (categorySlug.includes('sport') || category.includes('体育')) {
    return 'Trophy';
  }
  
  // 科技 -> 芯片（使用 Bot 图标）
  if (categorySlug.includes('tech') || category.includes('科技')) {
    return 'Bot';
  }
  
  // 金融 -> 建筑
  if (categorySlug.includes('finance') || category.includes('金融')) {
    return 'Building2';
  }
  
  // 加密货币 -> Bitcoin（但如果是独立市场，应该用 Coins）
  if (categorySlug.includes('crypto') || category.includes('加密货币')) {
    return 'Coins';
  }
  
  // 默认图标
  return 'Bitcoin';
}

/**
 * 🔥 根据图标名称获取图标组件
 */
export function getIconComponent(iconName: string): LucideIcon {
  return iconMap[iconName] || Bitcoin;
}

/**
 * 🔥 根据图标名称获取图标颜色
 */
export function getIconColor(iconName: string): string {
  const colorMap: Record<string, string> = {
    'Bitcoin': 'bg-[#f7931a]', // 橙色
    'Coins': 'bg-[#627EEA]', // 以太坊蓝色
    'Building2': 'bg-blue-800',
    'Trophy': 'bg-orange-600',
    'Bot': 'bg-purple-600',
    'Film': 'bg-pink-600',
    'Globe': 'bg-green-600',
  };
  
  return colorMap[iconName] || 'bg-[#f7931a]';
}
