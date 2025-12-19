import { prisma } from '@/lib/prisma';
import DataClient from './DataClient';

export const dynamic = "force-dynamic";

// Mock 数据（数据库查询失败时使用）
const mockHotMarketsForServer = [
  {
    id: 'mock-1',
    title: 'BTC 价格将在 2025 年 1 月超过 $100,000',
    description: '',
    category: '加密货币',
    categorySlug: 'crypto',
    icon: 'Bitcoin',
    yesPercent: 68,
    noPercent: 32,
    volume: 42000000,
    closingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'OPEN',
    isHot: true,
    rank: 1,
  },
  {
    id: 'mock-2',
    title: '2025 年 AI 领域将出现新的突破性产品',
    description: '',
    category: '科技',
    categorySlug: 'technology',
    icon: 'Cpu',
    yesPercent: 45,
    noPercent: 55,
    volume: 28500000,
    closingDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'OPEN',
    isHot: true,
    rank: 2,
  },
  {
    id: 'mock-3',
    title: '下一届美国总统选举结果预测',
    description: '',
    category: '政治',
    categorySlug: 'politics',
    icon: 'Building2',
    yesPercent: 52,
    noPercent: 48,
    volume: 38000000,
    closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'OPEN',
    isHot: true,
    rank: 3,
  },
  {
    id: 'mock-4',
    title: '2025 年 NBA 总冠军预测',
    description: '',
    category: '体育',
    categorySlug: 'sports',
    icon: 'Trophy',
    yesPercent: 38,
    noPercent: 62,
    volume: 19500000,
    closingDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'OPEN',
    isHot: true,
    rank: 4,
  },
  {
    id: 'mock-5',
    title: '全球股市将在 2025 年 Q1 上涨 10%',
    description: '',
    category: '金融',
    categorySlug: 'finance',
    icon: 'DollarSign',
    yesPercent: 58,
    noPercent: 42,
    volume: 31500000,
    closingDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'OPEN',
    isHot: true,
    rank: 5,
  },
];

export default async function DataPage() {
  let hotMarketsData = [];

  try {
    // 获取热门市场 Top 10（按 totalVolume 降序排序）
    // 只返回已发布（PUBLISHED）的热门市场
    const hotMarkets = await prisma.market.findMany({
      where: {
        status: 'OPEN',
        isHot: true, // 只获取热门市场
        reviewStatus: 'PUBLISHED', // 只显示已审核通过的市场
      },
      orderBy: {
        totalVolume: 'desc', // 按交易量降序排序
      },
      take: 10,
      include: {
        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
              },
            },
          },
        },
      },
    });

    // 将数据库数据转换为前端需要的格式
    hotMarketsData = hotMarkets.map(market => ({
      id: market.id,
      title: market.title,
      description: market.description || '',
      category: market.categories[0]?.category?.name || '未分类',
      categorySlug: market.categories[0]?.category?.slug || 'all',
      icon: market.categories[0]?.category?.icon || 'Bitcoin',
      yesPercent: market.yesProbability !== null && market.yesProbability !== undefined
        ? market.yesProbability
        : (market.totalYes && market.totalNo
            ? Math.round((market.totalYes / (market.totalYes + market.totalNo)) * 100)
            : 50),
      noPercent: market.noProbability !== null && market.noProbability !== undefined
        ? market.noProbability
        : (market.totalYes && market.totalNo
            ? Math.round((market.totalNo / (market.totalYes + market.totalNo)) * 100)
            : 50),
      volume: market.totalVolume || 0,
      rank: market.rank,
      closingDate: market.closingDate?.toISOString() || new Date().toISOString(),
      status: market.status,
      isHot: market.isHot,
    }));
  } catch (error) {
    // 数据库查询失败，使用 Mock 数据
    console.error('❌ [DataPage] 数据库查询失败，使用 Mock 数据:', error);
    hotMarketsData = mockHotMarketsForServer;
  }

  // 注意：统计数据现在从 GlobalStat 表中动态获取，不再在这里计算

  return (
    <DataClient
      hotMarkets={hotMarketsData.length > 0 ? hotMarketsData : mockHotMarketsForServer}
      // stats 字段保留用于向后兼容，但不再使用（改为从 GlobalStat 动态获取）
    />
  );
}
