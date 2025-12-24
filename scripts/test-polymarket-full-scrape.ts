/**
 * Polymarket 全量采集测试脚本
 * 
 * 🔥 彻底排查并修复采集 0 条数据的问题
 * 
 * 功能：
 * 1. 强制重置所有同步标记
 * 2. 执行全量采集
 * 3. 输出详细的诊断信息
 */

import { PolymarketAdapter } from '@/lib/scrapers/polymarketAdapter';
import { prisma } from '@/lib/prisma';

async function main() {
  console.log('🚀 ========== Polymarket 全量采集测试 ==========');
  console.log(`⏰ 开始时间: ${new Date().toISOString()}`);
  console.log('');

  try {
    // 🔥 强制重置：在脚本开头物理删除所有同步记忆
    console.log('🧹 步骤 1: 强制重置所有同步标记...');
    try {
      const resetResult = await prisma.dataSource.updateMany({
        where: { sourceName: 'Polymarket' },
        data: {
          lastSyncTime: null,
          itemsCount: 0,
        },
      });
      console.log(`✅ 已重置 ${resetResult.count} 条 DataSource 记录`);
    } catch (error) {
      console.error(`❌ 重置同步标记失败:`, error);
    }
    console.log('');

    // 创建适配器（limit=1000 全量抓取）
    console.log('🔧 步骤 2: 创建 PolymarketAdapter (limit=1000)...');
    const adapter = new PolymarketAdapter(1000);
    console.log('✅ 适配器创建成功');
    console.log('');

    // 执行采集
    console.log('📡 步骤 3: 执行采集任务...');
    console.log('');
    const result = await adapter.execute();
    console.log('');

    // 输出结果
    console.log('📊 ========== 采集结果 ==========');
    console.log(`✅ 采集成功: ${result.success}`);
    console.log(`📈 处理的数据条数: ${result.itemsCount}`);
    console.log(`❌ 错误信息: ${result.error || '无'}`);
    console.log('');

    // 验证数据库中的实际写入数量
    console.log('🔍 步骤 4: 验证数据库实际写入数量...');
    const dbMarketsCount = await prisma.market.count({
      where: {
        source: 'POLYMARKET',
        isActive: true,
      },
    });
    
    const pendingReviewCount = await prisma.market.count({
      where: {
        source: 'POLYMARKET',
        status: 'PENDING_REVIEW',
        isActive: true,
      },
    });
    
    const openMarketsCount = await prisma.market.count({
      where: {
        source: 'POLYMARKET',
        status: 'OPEN',
        isActive: true,
      },
    });

    console.log(`📊 数据库中 POLYMARKET 源的市场总数: ${dbMarketsCount}`);
    console.log(`📊 其中 PENDING_REVIEW 状态: ${pendingReviewCount}`);
    console.log(`📊 其中 OPEN 状态: ${openMarketsCount}`);
    console.log('');

    // 检查 DataSource 表的最终状态
    const dataSource = await prisma.dataSource.findUnique({
      where: { sourceName: 'Polymarket' },
    });
    console.log('📋 DataSource 表最终状态:');
    console.log(`   - lastSyncTime: ${dataSource?.lastSyncTime || 'null'}`);
    console.log(`   - itemsCount: ${dataSource?.itemsCount || 0}`);
    console.log(`   - status: ${dataSource?.status || 'N/A'}`);
    console.log('');

    console.log('✅ ========== 测试完成 ==========');
    console.log(`⏰ 结束时间: ${new Date().toISOString()}`);
    
    // 输出最终结论
    console.log('');
    console.log('📝 ========== 最终结论 ==========');
    if (result.success && result.itemsCount > 0) {
      console.log(`✅ API 返回数据: 是（${result.itemsCount} 条）`);
      console.log(`✅ 数据库写入: 成功（共 ${dbMarketsCount} 条 POLYMARKET 源市场）`);
    } else {
      console.log(`❌ API 返回数据: ${result.itemsCount > 0 ? '是' : '否'}（${result.itemsCount} 条）`);
      console.log(`❌ 数据库写入: ${dbMarketsCount > 0 ? '部分成功' : '失败'}`);
      if (result.error) {
        console.log(`❌ 错误详情: ${result.error}`);
      }
    }
    console.log('');

  } catch (error) {
    console.error('❌ ========== 测试失败 ==========');
    console.error('错误类型:', error?.constructor?.name || 'Unknown');
    console.error('错误消息:', error instanceof Error ? error.message : String(error));
    console.error('错误堆栈:', error instanceof Error ? error.stack : 'N/A');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
