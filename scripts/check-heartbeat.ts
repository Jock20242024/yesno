/**
 * 检查心跳记录脚本
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkHeartbeat() {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'lastFactoryRunAt' },
    });
    
    if (!setting) {
      console.log('❌ 没有找到心跳记录');
      return;
    }
    
    const lastRun = new Date(setting.value);
    const now = new Date();
    const diffMs = now.getTime() - lastRun.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    console.log('\n📊 心跳记录详情：');
    console.log(`   键名: ${setting.key}`);
    console.log(`   值: ${setting.value}`);
    console.log(`   更新时间: ${setting.updatedAt.toISOString()}`);
    console.log(`   最后运行时间: ${lastRun.toISOString()}`);
    console.log(`   当前时间: ${now.toISOString()}`);
    console.log(`   时间差: ${diffMinutes} 分钟 (${diffHours} 小时, ${diffDays} 天)`);
    console.log(`   状态: ${diffMinutes < 20 ? '🟢 健康' : '🔴 异常'}\n`);
    
  } catch (error: any) {
    console.error('❌ 检查心跳失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkHeartbeat();
