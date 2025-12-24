/**
 * 🔥 物理清零：彻底清空所有市场数据
 * 
 * 用途：将数据库恢复到白纸状态，用于验证新工厂逻辑的精准度
 * 执行：npx tsx scripts/reset-all-markets.ts
 * 
 * ⚠️ 警告：此脚本会物理删除所有市场记录，请确认后再执行
 */

import { prisma } from '../lib/prisma';

async function resetAllMarkets() {
  try {
    console.log('🧹 [Reset Markets] 开始物理清零所有市场数据...\n');
    
    // 🔥 先查询当前市场数量
    const marketCount = await prisma.market.count();
    console.log(`📊 [Reset Markets] Current Market Count: ${marketCount}\n`);
    
    if (marketCount === 0) {
      console.log('✅ [Reset Markets] 数据库已经是空状态，无需清零\n');
      console.log('✅ [Reset Markets] Current Market Count: 0\n');
      await prisma.$disconnect();
      return;
    }
    
    // 🔥 物理删除所有市场记录
    console.log('🗑️  [Reset Markets] 正在删除所有市场记录...\n');
    
    const deleteResult = await prisma.market.deleteMany({});
    
    console.log(`✅ [Reset Markets] 成功删除 ${deleteResult.count} 条市场记录\n`);
    
    // 🔥 验证删除结果
    const remainingCount = await prisma.market.count();
    
    if (remainingCount === 0) {
      console.log('✅ [Reset Markets] 验证通过：所有市场记录已彻底清除\n');
      console.log('✅ [Reset Markets] Current Market Count: 0\n');
      console.log('📋 [Reset Markets] 数据库已恢复到白纸状态，可以开始测试新工厂逻辑\n');
    } else {
      console.log(`⚠️  [Reset Markets] 警告：仍有 ${remainingCount} 条记录未被删除\n`);
      console.log(`⚠️  [Reset Markets] Current Market Count: ${remainingCount} (应该为 0)\n`);
    }
    
  } catch (error) {
    console.error('❌ [Reset Markets] 执行失败:', error);
    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行脚本
resetAllMarkets();
