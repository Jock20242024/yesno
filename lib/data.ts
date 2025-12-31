export interface MarketEvent {
  id: number;
  rank: number;
  title: string;
  category: string; // 中文名称
  categorySlug: string; // URL slug
  icon: string;
  iconColor: string;
  yesPercent: number;
  noPercent: number;
  deadline: string;
  imageUrl?: string;
  volume?: string;
  comments?: number;
}

// 🔥 已移除 MARKET_DATA Mock 数据数组
// 所有组件现在必须从 API 获取数据，确保显示最新内容
// 保留类型定义，供其他组件使用
export const MARKET_DATA: MarketEvent[] = [];

