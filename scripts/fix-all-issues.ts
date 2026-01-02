/**
 * 直接修复所有问题
 * 1. 创建缺失的数据源
 * 2. 检查数据库连接
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('=== 开始修复所有问题 ===\n');
  
  try {
    // 1. 检查数据库连接
    console.log('1. 检查数据库连接...');
    await prisma.$connect();
    console.log('✅ 数据库连接成功\n');
    
    // 2. 检查并创建数据源
    console.log('2. 检查数据源...');
    const existing = await prisma.data_sources.findMany({
      select: { sourceName: true },
    });
    console.log('现有数据源:', existing.map(e => e.sourceName));
    
    const requiredSources = [
      { 
        sourceName: 'Polymarket', 
        config: { apiUrl: 'https://gamma-api.polymarket.com/markets', defaultLimit: 100 } 
      },
      { 
        sourceName: '全网数据', 
        config: { type: 'global_stats', description: '全网统计数据采集源' } 
      },
    ];
    
    for (const source of requiredSources) {
      const exists = existing.some(e => e.sourceName === source.sourceName);
      
      if (!exists) {
        console.log(`\n创建数据源: ${source.sourceName}...`);
        try {
          await prisma.data_sources.create({
            data: {
              id: randomUUID(),
              sourceName: source.sourceName,
              status: 'ACTIVE',
              itemsCount: 0,
              multiplier: 1.0,
              config: JSON.stringify(source.config),
              updatedAt: new Date(),
            },
          });
          console.log(`✅ ${source.sourceName} 创建成功`);
        } catch (error: any) {
          console.error(`❌ ${source.sourceName} 创建失败:`, error.message);
          console.error('错误代码:', error.code);
        }
      } else {
        console.log(`✅ ${source.sourceName} 已存在`);
      }
    }
    
    // 3. 验证数据源
    console.log('\n3. 验证数据源...');
    const allSources = await prisma.data_sources.findMany({
      orderBy: { sourceName: 'asc' },
    });
    console.log(`总共 ${allSources.length} 个数据源:`);
    allSources.forEach(s => {
      console.log(`  - ${s.sourceName} (${s.status})`);
    });
    
    // 4. 检查操作日志表
    console.log('\n4. 检查操作日志表...');
    const logCount = await prisma.admin_logs.count();
    console.log(`操作日志记录数: ${logCount}`);
    
    if (logCount === 0) {
      console.log('⚠️ 操作日志表为空（这是正常的，如果没有操作记录）');
    } else {
      const sample = await prisma.admin_logs.findFirst({
        include: {
          users: {
            select: { email: true },
          },
        },
      });
      console.log('示例记录:', {
        actionType: sample?.actionType,
        adminEmail: (sample as any)?.users?.email,
      });
    }
    
    console.log('\n=== 修复完成 ===');
  } catch (error: any) {
    console.error('\n❌ 修复失败:', error.message);
    console.error('错误代码:', error.code);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
