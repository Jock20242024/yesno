/**
 * 测试 Polymarket 爬虫脚本
 * 强制全量重新抓取数据
 * 
 * 运行方式: npx tsx scripts/test-polymarket-scraper.ts
 */

import { PolymarketAdapter } from '../lib/scrapers/polymarketAdapter';
import { prisma } from '../lib/prisma';

async function main() {
  try {
    console.log('🚀 开始执行 Polymarket 全量抓取测试...');
    console.log('');
    
    // 🔥 重置同步标记：清空 DataSource 表中的同步时间记录
    console.log('🔄 重置同步标记...');
    await prisma.dataSource.updateMany({
      where: {
        sourceName: 'Polymarket',
      },
      data: {
        lastSyncTime: null,
        itemsCount: 0,
        status: 'ACTIVE',
        errorMessage: null,
      },
    });
    console.log('✅ 同步标记已重置');
    console.log('');
    
    // 🔥 创建爬虫实例，使用较大的 limit 确保全量抓取
    const adapter = new PolymarketAdapter(1000); // 抓取最多 1000 条数据
    
    // 执行抓取
    console.log('📡 开始执行爬虫...');
    const result = await adapter.execute();
    
    console.log('');
    console.log('📊 抓取结果:');
    console.log(`  - 成功: ${result.success}`);
    console.log(`  - 抓取数量: ${result.itemsCount} 条`);
    if (result.error) {
      console.log(`  - 错误: ${result.error}`);
    }
    console.log('');
    
    // 验证数据库中的记录
    const marketCount = await prisma.market.count({
      where: {
        source: 'POLYMARKET',
      },
    });
    
    const pendingReviewCount = await prisma.market.count({
      where: {
        source: 'POLYMARKET',
        status: 'PENDING_REVIEW',
      },
    });
    
    console.log('✅ 数据库验证:');
    console.log(`  - 总市场数量（POLYMARKET）: ${marketCount}`);
    console.log(`  - PENDING_REVIEW 状态数量: ${pendingReviewCount}`);
    console.log('');
    
    if (result.success && result.itemsCount > 0) {
      console.log('🎉 抓取成功！已成功创建/更新了', result.itemsCount, '条数据');
    } else {
      console.warn('⚠️  抓取结果为空或失败，请检查日志');
    }
    
  } catch (error) {
    console.error('❌ 脚本执行失败:', error);
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
