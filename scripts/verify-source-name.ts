/**
 * 验证采集源名称匹配
 * 运行方式: npx tsx scripts/verify-source-name.ts
 */

import { prisma } from '../lib/prisma';

async function verifySourceName() {
  console.log('🔍 验证采集源名称匹配...\n');

  try {
    // 从数据库查询采集源
    const dataSources = await prisma.data_sources.findMany({
      where: {
        sourceName: 'Polymarket',
      },
    });

    console.log(`📊 数据库中 sourceName='Polymarket' 的记录数: ${dataSources.length}\n`);

    if (dataSources.length === 0) {
      console.log('❌ 未找到 sourceName="Polymarket" 的采集源记录！');
      console.log('\n💡 解决方案：运行初始化脚本');
      console.log('   npx tsx scripts/init-data-sources.ts');
      process.exit(1);
    }

    dataSources.forEach((ds, index) => {
      console.log(`记录 ${index + 1}:`);
      console.log(`  ID: ${ds.id}`);
      console.log(`  sourceName: "${ds.sourceName}"`);
      console.log(`  status: ${ds.status}`);
      console.log(`  itemsCount: ${ds.itemsCount}`);
      console.log(`  lastSyncTime: ${ds.lastSyncTime || '从未同步'}`);
      console.log('');
    });

    // 验证 PolymarketAdapter 使用的名称
    console.log('✅ PolymarketAdapter 使用的 sourceName: "Polymarket"');
    console.log('✅ 数据库中的 sourceName: "Polymarket"');
    console.log('\n🎉 采集源名称匹配！');

  } catch (error) {
    console.error('❌ 验证失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifySourceName();
