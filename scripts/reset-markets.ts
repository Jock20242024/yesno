/**
 * 🔥 市场数据清理脚本
 * 
 * 用途：按照外键依赖顺序清理所有市场相关数据
 * 执行：npm run clean:markets
 * 
 * ⚠️ 警告：此脚本会物理删除所有市场、订单和持仓记录，但会保留用户数据
 * 
 * 删除顺序（按外键依赖）：
 * 1. Position（持仓）- 依赖 Market 和 User
 * 2. Order（订单）- 依赖 Market 和 User
 * 3. MarketCategory（市场分类关联）- 依赖 Market 和 Category
 * 4. Market（市场）- 最后删除
 * 
 * 保留：
 * - User（用户）
 * - Category（分类）
 * - MarketTemplate（市场模板）
 * - 其他系统表
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetMarkets() {
  try {
    console.log('🧹 [Reset Markets] 开始清理市场数据...\n');
    
    // 1. 统计当前数据量
    const positionCount = await prisma.position.count();
    const orderCount = await prisma.order.count();
    const marketCount = await prisma.market.count();
    const marketCategoryCount = await prisma.marketCategory.count();
    
    console.log('📊 [Reset Markets] 当前数据统计：');
    console.log(`  持仓 (Position): ${positionCount} 条`);
    console.log(`  订单 (Order): ${orderCount} 条`);
    console.log(`  市场 (Market): ${marketCount} 条`);
    console.log(`  市场分类关联 (MarketCategory): ${marketCategoryCount} 条\n`);
    
    if (positionCount === 0 && orderCount === 0 && marketCount === 0) {
      console.log('✅ [Reset Markets] 数据库已经是空状态，无需清理\n');
      await prisma.$disconnect();
      return;
    }
    
    // 2. 按照外键依赖顺序删除
    
    // 步骤1：删除 Position（持仓）
    console.log('🗑️  [Reset Markets] 正在删除持仓记录 (Position)...');
    const positionResult = await prisma.position.deleteMany({});
    console.log(`✅ [Reset Markets] 已删除 ${positionResult.count} 条持仓记录\n`);
    
    // 步骤2：删除 Order（订单）
    console.log('🗑️  [Reset Markets] 正在删除订单记录 (Order)...');
    const orderResult = await prisma.order.deleteMany({});
    console.log(`✅ [Reset Markets] 已删除 ${orderResult.count} 条订单记录\n`);
    
    // 步骤3：删除 MarketCategory（市场分类关联）
    console.log('🗑️  [Reset Markets] 正在删除市场分类关联 (MarketCategory)...');
    const marketCategoryResult = await prisma.marketCategory.deleteMany({});
    console.log(`✅ [Reset Markets] 已删除 ${marketCategoryResult.count} 条市场分类关联记录\n`);
    
    // 步骤4：删除 Market（市场）
    console.log('🗑️  [Reset Markets] 正在删除市场记录 (Market)...');
    const marketResult = await prisma.market.deleteMany({});
    console.log(`✅ [Reset Markets] 已删除 ${marketResult.count} 条市场记录\n`);
    
    // 3. 验证删除结果
    const remainingPositionCount = await prisma.position.count();
    const remainingOrderCount = await prisma.order.count();
    const remainingMarketCount = await prisma.market.count();
    const remainingMarketCategoryCount = await prisma.marketCategory.count();
    
    console.log('📊 [Reset Markets] 删除后数据统计：');
    console.log(`  持仓 (Position): ${remainingPositionCount} 条`);
    console.log(`  订单 (Order): ${remainingOrderCount} 条`);
    console.log(`  市场 (Market): ${remainingMarketCount} 条`);
    console.log(`  市场分类关联 (MarketCategory): ${remainingMarketCategoryCount} 条\n`);
    
    // 4. 验证 User 表是否保留
    const userCount = await prisma.user.count();
    console.log(`✅ [Reset Markets] 用户数据已保留: ${userCount} 个用户\n`);
    
    if (remainingPositionCount === 0 && remainingOrderCount === 0 && remainingMarketCount === 0 && remainingMarketCategoryCount === 0) {
      console.log('✅ [Reset Markets] 清理完成！所有市场相关数据已彻底清除\n');
      console.log('📋 [Reset Markets] 用户数据已保留，可以开始测试新逻辑\n');
    } else {
      console.log('⚠️  [Reset Markets] 警告：仍有数据未被删除\n');
      console.log(`  持仓: ${remainingPositionCount} 条`);
      console.log(`  订单: ${remainingOrderCount} 条`);
      console.log(`  市场: ${remainingMarketCount} 条`);
      console.log(`  市场分类关联: ${remainingMarketCategoryCount} 条\n`);
    }
    
  } catch (error) {
    console.error('❌ [Reset Markets] 执行失败:', error);
    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  } finally {
    console.log('🔌 [Reset Markets] 正在断开数据库连接...');
    await prisma.$disconnect();
    console.log('✅ [Reset Markets] 数据库连接已断开\n');
  }
}

// 执行脚本
resetMarkets();
