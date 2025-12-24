/**
 * 查询脚本：找出所有 image 为 NULL 且来源为 POLYMARKET 的市场 ID
 * 
 * 运行方式: npx tsx scripts/find-missing-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 查找所有 image 为 NULL 且来源为 POLYMARKET 的市场...\n');

  try {
    // 查询所有 image 为 NULL 的 POLYMARKET 市场
    const markets = await prisma.market.findMany({
      where: {
        source: 'POLYMARKET',
        isActive: true,
        OR: [
          { image: null },
          { image: '' },
        ],
      },
      select: {
        id: true,
        title: true,
        externalId: true,
        image: true,
        iconUrl: true,
        outcomePrices: true,
        initialPrice: true,
        volume24h: true,
        category: true,
        categorySlug: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`📊 找到 ${markets.length} 个缺少 image 的 POLYMARKET 市场\n`);

    if (markets.length === 0) {
      console.log('✅ 所有市场都有 image 数据！');
      return;
    }

    // 检查是否有 outcomePrices 和 initialPrice
    let missingOutcomePrices = 0;
    let missingInitialPrice = 0;
    let missingBoth = 0;

    markets.forEach(market => {
      const hasOutcomePrices = market.outcomePrices && market.outcomePrices.trim() !== '';
      const hasInitialPrice = market.initialPrice !== null && market.initialPrice !== undefined;
      
      if (!hasOutcomePrices) missingOutcomePrices++;
      if (!hasInitialPrice) missingInitialPrice++;
      if (!hasOutcomePrices && !hasInitialPrice) missingBoth++;
    });

    console.log('📋 数据缺失统计:');
    console.log(`  - 缺少 image: ${markets.length}`);
    console.log(`  - 缺少 outcomePrices: ${missingOutcomePrices}`);
    console.log(`  - 缺少 initialPrice: ${missingInitialPrice}`);
    console.log(`  - 同时缺少 outcomePrices 和 initialPrice: ${missingBoth}\n`);

    // 查找 'China invade Taiwan' 市场
    const chinaTaiwanMarket = markets.find(m => 
      m.title.toLowerCase().includes('china') && 
      (m.title.toLowerCase().includes('taiwan') || m.title.toLowerCase().includes('invade'))
    );

    if (chinaTaiwanMarket) {
      console.log('🔍 找到 "China invade Taiwan" 相关市场:');
      console.log(`  ID: ${chinaTaiwanMarket.id}`);
      console.log(`  External ID: ${chinaTaiwanMarket.externalId || 'NULL'}`);
      console.log(`  Title: ${chinaTaiwanMarket.title}`);
      console.log(`  Image: ${chinaTaiwanMarket.image || 'NULL'}`);
      console.log(`  IconUrl: ${chinaTaiwanMarket.iconUrl || 'NULL'}`);
      console.log(`  OutcomePrices: ${chinaTaiwanMarket.outcomePrices || 'NULL'}`);
      console.log(`  InitialPrice: ${chinaTaiwanMarket.initialPrice || 'NULL'}`);
      console.log(`  Category: ${chinaTaiwanMarket.category || 'NULL'}`);
      console.log(`  CategorySlug: ${chinaTaiwanMarket.categorySlug || 'NULL'}\n`);
    } else {
      console.log('⚠️  未找到 "China invade Taiwan" 相关市场\n');
    }

    // 输出前 10 个市场的详细信息
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 前 10 个缺少 image 的市场:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    markets.slice(0, 10).forEach((market, index) => {
      console.log(`${index + 1}. ${market.title}`);
      console.log(`   ID: ${market.id}`);
      console.log(`   External ID: ${market.externalId || 'NULL'}`);
      console.log(`   Image: ${market.image || 'NULL'}`);
      console.log(`   OutcomePrices: ${market.outcomePrices ? '✅ 有数据' : '❌ NULL'}`);
      console.log(`   InitialPrice: ${market.initialPrice !== null ? '✅ 有数据' : '❌ NULL'}`);
      console.log('');
    });

    // 输出所有市场 ID（用于后续批量更新）
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 所有缺少 image 的市场 ID 列表（用于批量更新）:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const marketIds = markets.map(m => m.id);
    const externalIds = markets
      .filter(m => m.externalId)
      .map(m => m.externalId!);
    
    console.log(`// 数据库 ID (共 ${marketIds.length} 个):`);
    console.log(JSON.stringify(marketIds, null, 2));
    console.log(`\n// External ID (共 ${externalIds.length} 个):`);
    console.log(JSON.stringify(externalIds, null, 2));
    
    // 保存到文件
    const fs = await import('fs');
    const path = await import('path');
    const outputPath = path.join(process.cwd(), 'scripts', 'missing-data-ids.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      marketIds,
      externalIds,
      count: markets.length,
      timestamp: new Date().toISOString(),
    }, null, 2));
    
    console.log(`\n✅ 已保存到: ${outputPath}\n`);

  } catch (error) {
    console.error('❌ 查询失败:', error);
    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
