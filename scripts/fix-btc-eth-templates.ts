/**
 * 🔥 临时脚本：修复 BTC 模板并创建 ETH 模板
 * 
 * 用途：恢复 BTC 模板的正确数据，并创建独立的 ETH 模板
 * 执行：npx tsx scripts/fix-btc-eth-templates.ts
 */

import { prisma } from '../lib/prisma';

async function fixTemplates() {
  try {
    console.log('🔧 [Template Fixer] 开始修复模板...\n');
    
    // 1. 查找现有的 BTC 模板
    const btcTemplate = await prisma.marketTemplate.findFirst({
      where: {
        symbol: 'BTC/USD',
        period: 15,
        type: 'UP_OR_DOWN',
      },
    });
    
    if (btcTemplate) {
      console.log(`📋 找到 BTC 模板: ID=${btcTemplate.id}`);
      console.log(`   当前名称: "${btcTemplate.name}"`);
      console.log(`   当前标的: "${btcTemplate.symbol}"\n`);
      
      // 恢复 BTC 模板
      const updatedBtc = await prisma.marketTemplate.update({
        where: { id: btcTemplate.id },
        data: {
          name: 'BTC涨跌-15分钟',
          symbol: 'BTC/USD',
          categorySlug: 'crypto',
          isActive: true,
          status: 'ACTIVE',
        },
      });
      
      console.log(`✅ BTC 模板已恢复:`);
      console.log(`   ID: ${updatedBtc.id}`);
      console.log(`   名称: "${updatedBtc.name}"`);
      console.log(`   标的: "${updatedBtc.symbol}"`);
      console.log(`   周期: ${updatedBtc.period}`);
      console.log(`   类型: ${updatedBtc.type}\n`);
    } else {
      console.log('⚠️  未找到 BTC 模板，将创建新记录\n');
      
      // 创建 BTC 模板
      const newBtc = await prisma.marketTemplate.create({
        data: {
          name: 'BTC涨跌-15分钟',
          symbol: 'BTC/USD',
          period: 15,
          type: 'UP_OR_DOWN',
          categorySlug: 'crypto',
          advanceTime: 120,
          isActive: true,
          status: 'ACTIVE',
          failureCount: 0,
        },
      });
      
      console.log(`✅ BTC 模板已创建: ID=${newBtc.id}\n`);
    }
    
    // 2. 检查是否已存在 ETH 模板
    const ethTemplate = await prisma.marketTemplate.findFirst({
      where: {
        symbol: 'ETH/USD',
        period: 15,
        type: 'UP_OR_DOWN',
      },
    });
    
    if (ethTemplate) {
      console.log(`📋 找到现有 ETH 模板: ID=${ethTemplate.id}`);
      console.log(`   名称: "${ethTemplate.name}"`);
      console.log(`   标的: "${ethTemplate.symbol}"\n`);
      
      // 确保 ETH 模板数据正确
      const updatedEth = await prisma.marketTemplate.update({
        where: { id: ethTemplate.id },
        data: {
          name: 'ETH涨跌-15分钟',
          symbol: 'ETH/USD',
          categorySlug: 'crypto',
          isActive: true,
          status: 'ACTIVE',
        },
      });
      
      console.log(`✅ ETH 模板已更新:`);
      console.log(`   ID: ${updatedEth.id}`);
      console.log(`   名称: "${updatedEth.name}"`);
      console.log(`   标的: "${updatedEth.symbol}"`);
      console.log(`   周期: ${updatedEth.period}`);
      console.log(`   类型: ${updatedEth.type}\n`);
    } else {
      console.log('📋 未找到 ETH 模板，将创建新记录\n');
      
      // 创建 ETH 模板
      const newEth = await prisma.marketTemplate.create({
        data: {
          name: 'ETH涨跌-15分钟',
          symbol: 'ETH/USD',
          period: 15,
          type: 'UP_OR_DOWN',
          categorySlug: 'crypto',
          advanceTime: 120,
          isActive: true,
          status: 'ACTIVE',
          failureCount: 0,
        },
      });
      
      console.log(`✅ ETH 模板已创建:`);
      console.log(`   ID: ${newEth.id}`);
      console.log(`   名称: "${newEth.name}"`);
      console.log(`   标的: "${newEth.symbol}"`);
      console.log(`   周期: ${newEth.period}`);
      console.log(`   类型: ${newEth.type}\n`);
    }
    
    // 3. 验证最终结果
    console.log('🔍 [Template Fixer] 验证最终结果...\n');
    
    const allTemplates = await prisma.marketTemplate.findMany({
      where: {
        period: 15,
        type: 'UP_OR_DOWN',
      },
      orderBy: { symbol: 'asc' },
    });
    
    console.log(`📊 数据库中共有 ${allTemplates.length} 个 period=15 的模板：\n`);
    allTemplates.forEach((t, idx) => {
      console.log(`   ${idx + 1}. symbol="${t.symbol}", name="${t.name}", categorySlug=${t.categorySlug || '(无)'}`);
    });
    
    // 验证 BTC 和 ETH 都存在
    const hasBtc = allTemplates.some(t => t.symbol === 'BTC/USD');
    const hasEth = allTemplates.some(t => t.symbol === 'ETH/USD');
    
    console.log('\n✅ 验证结果:');
    console.log(`   BTC/USD 模板: ${hasBtc ? '✅ 存在' : '❌ 缺失'}`);
    console.log(`   ETH/USD 模板: ${hasEth ? '✅ 存在' : '❌ 缺失'}`);
    
    if (hasBtc && hasEth) {
      console.log('\n🎉 修复完成！BTC 和 ETH 模板都已正确设置。\n');
    } else {
      console.log('\n⚠️  警告：部分模板缺失，请检查。\n');
    }
    
  } catch (error) {
    console.error('❌ [Template Fixer] 执行失败:', error);
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
fixTemplates();
