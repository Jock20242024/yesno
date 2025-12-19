/**
 * 种子脚本：创建待审核市场测试数据
 * 运行方式: npx tsx scripts/seed-pending-markets.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始创建待审核市场测试数据...');

  // 获取现有分类
  const cryptoCategory = await prisma.category.findFirst({
    where: { slug: 'crypto' },
  });
  const politicsCategory = await prisma.category.findFirst({
    where: { slug: 'politics' },
  });
  const financeCategory = await prisma.category.findFirst({
    where: { slug: 'finance' },
  });
  const techCategory = await prisma.category.findFirst({
    where: { slug: 'technology' },
  });

  if (!cryptoCategory || !politicsCategory || !financeCategory || !techCategory) {
    console.error('❌ 分类不存在，请先运行 npx prisma db seed');
    process.exit(1);
  }

  // 定义待审核市场数据
  const pendingMarkets = [
    {
      title: '2024 美联储降息预测',
      description: '预测 2024 年美联储是否会进行降息操作',
      categoryId: financeCategory.id,
      categorySlug: 'finance',
      totalVolume: 12500000,
      yesProbability: 58,
      noProbability: 42,
      closingDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45天后
    },
    {
      title: 'BTC 年底突破 10 万刀',
      description: '预测比特币（BTC）是否会在 2025 年底前突破 10 万美元',
      categoryId: cryptoCategory.id,
      categorySlug: 'crypto',
      totalVolume: 9500000,
      yesProbability: 65,
      noProbability: 35,
      closingDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1年后
    },
    {
      title: '2024 美国大选结果预测',
      description: '预测 2024 年美国总统选举的最终获胜者',
      categoryId: politicsCategory.id,
      categorySlug: 'politics',
      totalVolume: 18500000,
      yesProbability: 52,
      noProbability: 48,
      closingDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60天后
    },
    {
      title: '2025 年 AI 领域突破性产品发布',
      description: '预测 2025 年 AI 领域是否会出现突破性产品',
      categoryId: techCategory.id,
      categorySlug: 'technology',
      totalVolume: 5200000,
      yesProbability: 48,
      noProbability: 52,
      closingDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180天后
    },
    {
      title: 'ETH 价格在本季度上涨 20%',
      description: '预测以太坊（ETH）价格是否会在本季度上涨超过 20%',
      categoryId: cryptoCategory.id,
      categorySlug: 'crypto',
      totalVolume: 6800000,
      yesProbability: 55,
      noProbability: 45,
      closingDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90天后
    },
  ];

  console.log(`📝 准备创建 ${pendingMarkets.length} 个待审核市场...`);

  for (const marketData of pendingMarkets) {
    try {
      // 检查是否已存在相同标题的市场
      const existing = await prisma.market.findFirst({
        where: {
          title: marketData.title,
          reviewStatus: 'PENDING',
        },
      });

      if (existing) {
        console.log(`  ⏭️  市场已存在，跳过: ${marketData.title}`);
        continue;
      }

      // 创建市场
      const market = await prisma.market.create({
        data: {
          title: marketData.title,
          description: marketData.description,
          closingDate: marketData.closingDate,
          status: 'OPEN',
          reviewStatus: 'PENDING', // 关键：设置为待审核
          totalVolume: marketData.totalVolume,
          yesProbability: marketData.yesProbability,
          noProbability: marketData.noProbability,
          category: marketData.categorySlug, // 兼容字段
          categorySlug: marketData.categorySlug,
        },
      });

      // 创建分类关联
      await prisma.marketCategory.create({
        data: {
          marketId: market.id,
          categoryId: marketData.categoryId,
        },
      });

      console.log(`  ✅ 已创建市场: ${market.title} (ID: ${market.id})`);
    } catch (error) {
      console.error(`  ❌ 创建市场失败: ${marketData.title}`, error);
    }
  }

  console.log('');
  console.log('✅ 待审核市场测试数据创建完成！');
  console.log('💡 现在可以访问 /admin/markets/review 查看待审核事件');
}

main()
  .catch((e) => {
    console.error('❌ 脚本执行失败:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
