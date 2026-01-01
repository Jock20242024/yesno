/**
 * 手动创建心跳记录脚本
 * 用于测试和修复心跳监测问题
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import dayjs from '@/lib/dayjs';

const prisma = new PrismaClient();

async function createHeartbeat() {
  try {
    const nowUtc = dayjs.utc().toISOString();
    
    console.log('💓 正在创建/更新心跳记录...');
    console.log(`   时间: ${nowUtc}`);
    
    const result = await prisma.system_settings.upsert({
      where: { key: 'lastFactoryRunAt' },
      update: { value: nowUtc },
      create: { key: 'lastFactoryRunAt', value: nowUtc },
    });
    
    console.log('✅ 心跳记录已创建/更新：');
    console.log(`   键名: ${result.key}`);
    console.log(`   值: ${result.value}`);
    console.log(`   更新时间: ${result.updatedAt.toISOString()}`);
    console.log('\n💡 提示：现在前端应该显示绿色状态了！');
    
  } catch (error: any) {
    console.error('❌ 创建心跳记录失败:', error.message);
    console.error('错误堆栈:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

createHeartbeat();

