/**
 * 清理"全网数据"占位符数据源脚本
 * 
 * 此脚本用于删除数据库中已存在的"全网数据"占位符数据源记录
 * 因为该数据源没有实际运行逻辑，容易造成混淆
 * 
 * 使用方法：
 * npx tsx scripts/cleanup-global-data-source.ts
 */

import { prisma } from '@/lib/prisma';

async function cleanupGlobalDataSource() {
  try {
    console.log('🔄 [Cleanup] 开始清理"全网数据"占位符数据源...');
    
    // 查找"全网数据"数据源
    const globalDataSource = await prisma.data_sources.findFirst({
      where: {
        sourceName: '全网数据',
      },
    });
    
    if (!globalDataSource) {
      console.log('✅ [Cleanup] "全网数据"数据源不存在，无需清理');
      return;
    }
    
    console.log(`📋 [Cleanup] 找到"全网数据"数据源 (ID: ${globalDataSource.id})`);
    
    // 删除数据源
    await prisma.data_sources.delete({
      where: {
        id: globalDataSource.id,
      },
    });
    
    console.log('✅ [Cleanup] 已成功删除"全网数据"占位符数据源');
    console.log('💡 [Cleanup] 提示：全局统计计算应使用"全网数据计算(脚本B)"任务，而不是"全网数据"数据源');
    
  } catch (error) {
    console.error('❌ [Cleanup] 清理失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行清理
cleanupGlobalDataSource()
  .then(() => {
    console.log('\n✅ [Cleanup] 清理完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ [Cleanup] 清理失败:', error);
    process.exit(1);
  });

