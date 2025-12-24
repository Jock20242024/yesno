/**
 * 检查同步相关表的脚本
 * 检查是否存在 SyncLog、ScraperConfig 等同步记录表
 * 
 * 运行方式: npx tsx scripts/check-sync-tables.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSyncTables() {
  try {
    console.log('🔍 检查数据库中是否存在同步相关表...');
    console.log('');
    
    // 使用原生 SQL 查询所有表名
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `;
    
    console.log('📊 数据库中的所有表:');
    tables.forEach(({ tablename }) => {
      console.log(`  - ${tablename}`);
    });
    
    console.log('');
    
    // 查找可能相关的表
    const syncRelatedTables = tables.filter(({ tablename }) => 
      tablename.toLowerCase().includes('sync') ||
      tablename.toLowerCase().includes('scraper') ||
      tablename.toLowerCase().includes('log') ||
      tablename.toLowerCase().includes('config')
    );
    
    if (syncRelatedTables.length > 0) {
      console.log('⚠️  发现可能的同步相关表:');
      syncRelatedTables.forEach(({ tablename }) => {
        console.log(`  - ${tablename}`);
      });
      console.log('');
      
      // 尝试查询这些表的数据
      for (const { tablename } of syncRelatedTables) {
        try {
          const count = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
            `SELECT COUNT(*) as count FROM "${tablename}";`
          );
          console.log(`  ${tablename}: ${count[0]?.count || 0} 条记录`);
        } catch (error) {
          console.log(`  ${tablename}: 无法查询（可能不是 Prisma 管理的表）`);
        }
      }
    } else {
      console.log('✅ 未发现 SyncLog、ScraperConfig 等同步相关表');
      console.log('   数据库中只有 DataSource 表用于记录同步状态');
    }
    
    // 检查 DataSource 表
    console.log('');
    console.log('📊 DataSource 表状态:');
    const dataSources = await prisma.dataSource.findMany();
    if (dataSources.length > 0) {
      dataSources.forEach(ds => {
        console.log(`  - ${ds.sourceName}: lastSyncTime=${ds.lastSyncTime?.toISOString() || 'null'}, itemsCount=${ds.itemsCount}, status=${ds.status}`);
      });
    } else {
      console.log('  - 无数据源记录');
    }
    
  } catch (error) {
    console.error('❌ 检查失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkSyncTables()
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
