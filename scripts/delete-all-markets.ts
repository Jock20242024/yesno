/**
 * 临时脚本：删除数据库中所有市场数据
 * 
 * 警告：此操作不可逆，请谨慎使用！
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllMarkets() {
  try {
    console.log('🗑️  开始删除所有市场数据...');
    
    // 先统计当前市场数量
    const countBefore = await prisma.market.count();
    console.log(`📊 删除前市场数量: ${countBefore}`);
    
    if (countBefore === 0) {
      console.log('✅ 数据库中没有市场数据，无需删除');
      return;
    }
    
    // 删除所有市场数据
    const result = await prisma.market.deleteMany({});
    
    console.log(`✅ 删除完成！共删除 ${result.count} 条市场记录`);
    
    // 验证删除结果
    const countAfter = await prisma.market.count();
    console.log(`📊 删除后市场数量: ${countAfter}`);
    
    if (countAfter === 0) {
      console.log('✅ 确认：数据库中的 Market 表已归零');
    } else {
      console.warn(`⚠️  警告：删除后仍有 ${countAfter} 条记录，可能存在问题`);
    }
    
  } catch (error) {
    console.error('❌ 删除市场数据失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行删除
deleteAllMarkets()
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
