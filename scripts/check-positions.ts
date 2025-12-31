/**
 * 检查 Position 表中的异常数据
 * 查询当前用户的 Position 数据，重点检查 avgPrice 字段
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPositions() {
  try {
    console.log('🔍 开始查询 Position 数据...\n');
    
    // 查询所有最近的 Position 记录（按创建时间倒序）
    const positions = await prisma.position.findMany({
      include: {
        market: {
          select: {
            id: true,
            title: true,
            status: true,
            totalYes: true,
            totalNo: true,
            totalVolume: true,
            resolvedOutcome: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // 查询最近 50 条
    });

    console.log(`📊 共找到 ${positions.length} 条 Position 记录\n`);
    console.log('═'.repeat(100));
    console.log('═'.repeat(100));
    console.log('\n');

    if (positions.length === 0) {
      console.log('❌ 未找到任何 Position 记录');
      return;
    }

    // 详细报告每条记录
    positions.forEach((position, index) => {
      const market = position.market;
      const user = position.user;
      const totalVolume = (market.totalYes || 0) + (market.totalNo || 0);
      const yesPrice = totalVolume > 0 ? (market.totalYes || 0) / totalVolume : 0.5;
      const noPrice = totalVolume > 0 ? (market.totalNo || 0) / totalVolume : 0.5;
      const currentPrice = position.outcome === 'YES' ? yesPrice : noPrice;
      
      // 计算当前价值和盈亏
      const currentValue = position.shares * currentPrice;
      const costBasis = position.shares * position.avgPrice;
      const profitLoss = currentValue - costBasis;
      const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

      console.log(`📌 Position #${index + 1}`);
      console.log('─'.repeat(100));
      console.log(`   ID: ${position.id}`);
      console.log(`   用户: ${user.email} (${user.id})`);
      console.log(`   市场: ${market.title}`);
      console.log(`   市场ID: ${market.id}`);
      console.log(`   市场状态: ${market.status}`);
      console.log(`   市场结果: ${market.resolvedOutcome || '未结算'}`);
      console.log('');
      console.log(`   📈 持仓信息:`);
      console.log(`      - 方向: ${position.outcome}`);
      console.log(`      - 份额: ${position.shares.toLocaleString()} shares`);
      console.log(`      - 平均买入价 (avgPrice): $${position.avgPrice.toFixed(4)} ⚠️ 重点检查`);
      console.log(`      - 持仓状态: ${position.status}`);
      console.log('');
      console.log(`   💰 市场流动性数据:`);
      console.log(`      - Total Yes: ${(market.totalYes || 0).toLocaleString()}`);
      console.log(`      - Total No: ${(market.totalNo || 0).toLocaleString()}`);
      console.log(`      - Total Volume: ${totalVolume.toLocaleString()}`);
      console.log(`      - 当前 YES 价格: $${yesPrice.toFixed(4)}`);
      console.log(`      - 当前 NO 价格: $${noPrice.toFixed(4)}`);
      console.log(`      - 持仓方向的当前价格: $${currentPrice.toFixed(4)}`);
      console.log('');
      console.log(`   📊 盈亏分析:`);
      console.log(`      - 成本基础 (Cost Basis): $${costBasis.toFixed(2)}`);
      console.log(`      - 当前价值 (Current Value): $${currentValue.toFixed(2)}`);
      console.log(`      - 盈亏 (P&L): $${profitLoss >= 0 ? '+' : ''}${profitLoss.toFixed(2)}`);
      console.log(`      - 盈亏百分比: ${profitLossPercent >= 0 ? '+' : ''}${profitLossPercent.toFixed(2)}%`);
      console.log('');
      console.log(`   🕐 时间信息:`);
      console.log(`      - 创建时间: ${position.createdAt.toLocaleString('zh-CN')}`);
      console.log(`      - 更新时间: ${position.updatedAt.toLocaleString('zh-CN')}`);
      console.log('');
      
      // ⚠️ 异常检测
      if (position.avgPrice >= 1.0) {
        console.log(`   ⚠️ 异常警告: avgPrice = $${position.avgPrice.toFixed(4)} >= $1.00`);
        console.log(`      这可能表示:`);
        console.log(`      - 下单时市场价格确实接近 $1.00 (流动性极低)`);
        console.log(`      - 或者数据存储/计算有误`);
        console.log(`      建议: 检查关联订单记录确认实际成交价格`);
        console.log('');
      }
      
      if (position.avgPrice <= 0 || position.avgPrice > 1.0) {
        console.log(`   ❌ 数据异常: avgPrice = $${position.avgPrice.toFixed(4)} (应该在 0-1 之间)`);
        console.log('');
      }

      console.log('─'.repeat(100));
      console.log('\n');
    });

    // 汇总统计
    console.log('═'.repeat(100));
    console.log('📊 汇总统计');
    console.log('═'.repeat(100));
    console.log('');
    
    const avgPriceStats = positions.map(p => p.avgPrice);
    const avgPriceMean = avgPriceStats.reduce((a, b) => a + b, 0) / avgPriceStats.length;
    const avgPriceMin = Math.min(...avgPriceStats);
    const avgPriceMax = Math.max(...avgPriceStats);
    
    const suspiciousPositions = positions.filter(p => p.avgPrice >= 1.0);
    
    console.log(`   总记录数: ${positions.length}`);
    console.log(`   avgPrice 平均值: $${avgPriceMean.toFixed(4)}`);
    console.log(`   avgPrice 最小值: $${avgPriceMin.toFixed(4)}`);
    console.log(`   avgPrice 最大值: $${avgPriceMax.toFixed(4)}`);
    console.log(`   ⚠️ 可疑记录 (avgPrice >= 1.0): ${suspiciousPositions.length} 条`);
    
    if (suspiciousPositions.length > 0) {
      console.log('');
      console.log('   可疑记录详情:');
      suspiciousPositions.forEach((p, idx) => {
        console.log(`      ${idx + 1}. ${p.market.title.substring(0, 40)}...`);
        console.log(`         avgPrice: $${p.avgPrice.toFixed(4)}, 份额: ${p.shares}, 方向: ${p.outcome}`);
      });
    }
    
    console.log('\n');
    console.log('═'.repeat(100));
    console.log('✅ 查询完成');
    console.log('═'.repeat(100));

  } catch (error) {
    console.error('❌ 查询失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行查询
checkPositions()
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });

