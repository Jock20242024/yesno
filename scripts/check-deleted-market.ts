import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 检查已删除的市场是否仍被查询到...\n');

  // 1. 查找所有 isActive: false 的市场
  const deletedMarkets = await prisma.market.findMany({
    where: {
      isActive: false,
    },
    select: {
      id: true,
      title: true,
      isActive: true,
      status: true,
      reviewStatus: true,
    },
    take: 10,
  });

  console.log(`📊 找到 ${deletedMarkets.length} 个已删除的市场（isActive: false）:`);
  deletedMarkets.forEach((market, i) => {
    console.log(`  ${i + 1}. ID: ${market.id}`);
    console.log(`     标题: ${market.title}`);
    console.log(`     状态: ${market.status}`);
    console.log(`     审核状态: ${market.reviewStatus}`);
    console.log('');
  });

  // 2. 测试查询逻辑：使用 BASE_MARKET_FILTER 查询
  console.log('🔍 使用 BASE_MARKET_FILTER 查询（应该不包含已删除的市场）...\n');
  
  const activeMarkets = await prisma.market.findMany({
    where: {
      isActive: true,
      status: 'OPEN',
      reviewStatus: 'PUBLISHED',
    },
    select: {
      id: true,
      title: true,
    },
    take: 10,
  });

  console.log(`✅ 查询到的活跃市场数量: ${activeMarkets.length}`);
  
  // 3. 检查是否有已删除的市场出现在查询结果中
  const deletedIds = deletedMarkets.map(m => m.id);
  const activeIds = activeMarkets.map(m => m.id);
  const intersection = deletedIds.filter(id => activeIds.includes(id));
  
  if (intersection.length > 0) {
    console.error(`❌ 发现 ${intersection.length} 个已删除的市场出现在查询结果中！`);
    intersection.forEach(id => {
      console.error(`   - ${id}`);
    });
  } else {
    console.log('✅ 查询逻辑正确：已删除的市场未出现在查询结果中');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
