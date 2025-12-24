import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 开始清空工厂库存（只删除 isFactory = true 的市场）...\n');

  // 1. 先统计一下当前状态
  const factoryMarketsCount = await prisma.market.count({
    where: { isFactory: true },
  });

  const manualMarketsCount = await prisma.market.count({
    where: { isFactory: false },
  });

  console.log(`📊 当前状态：`);
  console.log(`  工厂市场（isFactory = true）: ${factoryMarketsCount} 个`);
  console.log(`  手动市场（isFactory = false）: ${manualMarketsCount} 个\n`);

  if (factoryMarketsCount === 0) {
    console.log('✅ 工厂库存已经是空的，无需删除。');
    return;
  }

  // 2. 物理删除所有工厂市场
  console.log('🗑️  正在删除所有工厂市场...');
  const deleteResult = await prisma.market.deleteMany({
    where: { isFactory: true },
  });

  console.log(`✅ 已删除 ${deleteResult.count} 个工厂市场\n`);

  // 3. 验证删除结果
  const remainingFactoryCount = await prisma.market.count({
    where: { isFactory: true },
  });

  const remainingManualCount = await prisma.market.count({
    where: { isFactory: false },
  });

  console.log(`📊 删除后状态：`);
  console.log(`  工厂市场（isFactory = true）: ${remainingFactoryCount} 个`);
  console.log(`  手动市场（isFactory = false）: ${remainingManualCount} 个\n`);

  if (remainingFactoryCount === 0 && remainingManualCount === manualMarketsCount) {
    console.log('✅ 工厂已清空！手动市场已保留。');
  } else {
    console.log('⚠️  警告：删除结果与预期不符！');
  }
}

main()
  .catch((e) => {
    console.error('❌ 错误：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
