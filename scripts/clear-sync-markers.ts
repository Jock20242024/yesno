/**
 * 清理同步标记脚本
 * 清空 DataSource 表中的同步时间记录
 * 
 * 运行方式: npx tsx scripts/clear-sync-markers.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearSyncMarkers() {
  try {
    console.log('🧹 开始清理同步标记...');
    
    // 清空所有 DataSource 的同步时间记录
    const result = await prisma.dataSource.updateMany({
      data: {
        lastSyncTime: null,
        itemsCount: 0,
        status: 'ACTIVE',
        errorMessage: null,
      },
    });
    
    console.log(`✅ 已清理 ${result.count} 个数据源的同步标记`);
    
    // 验证清理结果
    const dataSources = await prisma.dataSource.findMany();
    console.log(`📊 当前数据源列表:`);
    dataSources.forEach(ds => {
      console.log(`  - ${ds.sourceName}: lastSyncTime=${ds.lastSyncTime || 'null'}, itemsCount=${ds.itemsCount}, status=${ds.status}`);
    });
    
  } catch (error) {
    console.error('❌ 清理同步标记失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearSyncMarkers()
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
