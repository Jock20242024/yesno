/**
 * 修复所有 Admin API 的权限验证
 * 确保所有 API 都同时支持 NextAuth session 和 adminToken cookie
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function fixDataSources() {
  console.log('=== 修复 data_sources 表 ===\n');
  
  try {
    // 检查现有的数据源
    const existing = await prisma.data_sources.findMany({
      select: { sourceName: true },
    });
    
    console.log('现有的数据源:', existing.map(e => e.sourceName));
    console.log('');
    
    const requiredSources = [
      { sourceName: 'Polymarket', config: { apiUrl: 'https://gamma-api.polymarket.com/markets', defaultLimit: 100 } },
      { sourceName: '全网数据', config: { type: 'global_stats', description: '全网统计数据采集源' } },
    ];
    
    for (const source of requiredSources) {
      const exists = existing.some(e => e.sourceName === source.sourceName);
      
      if (!exists) {
        console.log(`创建数据源: ${source.sourceName}...`);
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
        console.log(`✅ ${source.sourceName} 已创建\n`);
      } else {
        console.log(`✅ ${source.sourceName} 已存在\n`);
      }
    }
    
    console.log('=== 数据源修复完成 ===\n');
  } catch (error: any) {
    console.error('❌ 修复失败:', error.message);
  }
}

async function checkAdminLogs() {
  console.log('=== 检查 admin_logs 表 ===\n');
  
  try {
    const count = await prisma.admin_logs.count();
    console.log(`admin_logs 表记录数: ${count}`);
    
    if (count === 0) {
      console.log('⚠️ admin_logs 表为空（这是正常的，如果没有操作记录）');
    } else {
      const sample = await prisma.admin_logs.findFirst({
        include: {
          users: {
            select: { email: true },
          },
        },
      });
      console.log('示例记录:', {
        id: sample?.id,
        actionType: sample?.actionType,
        adminEmail: (sample as any)?.users?.email,
      });
    }
    
    console.log('');
  } catch (error: any) {
    console.error('❌ 检查失败:', error.message);
  }
}

async function main() {
  await fixDataSources();
  await checkAdminLogs();
  await prisma.$disconnect();
}

main();
