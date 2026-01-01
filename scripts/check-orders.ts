/**
 * 检查 Order 表中的订单数据
 * 关联 Position 和 Market 数据，确认实际成交价格
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOrders() {
  try {
    console.log('🔍 开始查询 Order 数据...\n');
    
    // 查询所有最近的订单记录（按创建时间倒序）
    const orders = await prisma.orders.findMany({
      include: {
        market: {
          select: {
            id: true,
            title: true,
            status: true,
            totalYes: true,
            totalNo: true,
            totalVolume: true,
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

    console.log(`📊 共找到 ${orders.length} 条 Order 记录\n`);
    console.log('═'.repeat(120));
    console.log('═'.repeat(120));
    console.log('\n');

    if (orders.length === 0) {
      console.log('❌ 未找到任何 Order 记录');
      return;
    }

    // 详细报告每条记录
    orders.forEach((order, index) => {
      const market = order.market;
      const user = order.user;
      const totalVolume = (market.totalYes || 0) + (market.totalNo || 0);
      
      // 计算订单时的市场价格（基于订单金额和成交份额）
      let calculatedPrice = 0;
      if (order.filledAmount && order.filledAmount > 0) {
        // 如果订单有 filledAmount，价格 = amount / filledAmount
        calculatedPrice = order.amount / order.filledAmount;
      } else if (totalVolume > 0) {
        // 否则根据市场流动性估算
        calculatedPrice = order.outcomeSelection === 'YES' 
          ? (market.totalYes || 0) / totalVolume
          : (market.totalNo || 0) / totalVolume;
      }

      console.log(`📌 Order #${index + 1}`);
      console.log('─'.repeat(120));
      console.log(`   ID: ${order.id}`);
      console.log(`   用户: ${user.email} (${user.id})`);
      console.log(`   市场: ${market.title}`);
      console.log(`   市场ID: ${market.id}`);
      console.log(`   市场状态: ${market.status}`);
      console.log('');
      console.log(`   📝 订单信息:`);
      console.log(`      - 类型: ${order.orderType || 'MARKET'} (${order.type || 'BUY'})`);
      console.log(`      - 状态: ${order.status}`);
      console.log(`      - 方向: ${order.outcomeSelection}`);
      console.log(`      - 订单金额: $${order.amount.toFixed(2)}`);
      console.log(`      - 手续费: $${(order.feeDeducted || 0).toFixed(2)}`);
      console.log(`      - 实际金额: $${(order.amount - (order.feeDeducted || 0)).toFixed(2)}`);
      if (order.limitPrice) {
        console.log(`      - 限价: $${order.limitPrice.toFixed(4)}`);
      }
      if (order.filledAmount) {
        console.log(`      - 已成交份额: ${order.filledAmount.toFixed(4)} shares`);
      }
      console.log(`      - 计算出的成交价格: $${calculatedPrice.toFixed(4)} ⚠️ 重点检查`);
      console.log('');
      console.log(`   💰 市场流动性数据 (订单时):`);
      console.log(`      - Total Yes: ${(market.totalYes || 0).toLocaleString()}`);
      console.log(`      - Total No: ${(market.totalNo || 0).toLocaleString()}`);
      console.log(`      - Total Volume: ${totalVolume.toLocaleString()}`);
      if (totalVolume > 0) {
        const yesPrice = (market.totalYes || 0) / totalVolume;
        const noPrice = (market.totalNo || 0) / totalVolume;
        console.log(`      - YES 价格: $${yesPrice.toFixed(4)}`);
        console.log(`      - NO 价格: $${noPrice.toFixed(4)}`);
      }
      console.log('');
      console.log(`   🕐 时间信息:`);
      console.log(`      - 创建时间: ${order.createdAt.toLocaleString('zh-CN')}`);
      console.log(`      - 更新时间: ${order.updatedAt.toLocaleString('zh-CN')}`);
      console.log('');
      
      // ⚠️ 异常检测
      if (calculatedPrice >= 1.0 || calculatedPrice <= 0) {
        console.log(`   ⚠️ 异常警告: 计算出的成交价格 = $${calculatedPrice.toFixed(4)}`);
        console.log(`      这可能表示:`);
        console.log(`      - 流动性极低导致价格异常`);
        console.log(`      - 或者数据计算/存储有误`);
        console.log('');
      }
      
      if (order.amount >= 90 && order.amount <= 100) {
        console.log(`   🔍 疑似 $90 订单: 金额为 $${order.amount.toFixed(2)}，请重点检查！`);
        console.log('');
      }

      console.log('─'.repeat(120));
      console.log('\n');
    });

    // 查找金额接近 $90 的订单
    const targetOrders = orders.filter(o => Math.abs(o.amount - 90) < 10);
    
    console.log('═'.repeat(120));
    console.log('🔍 疑似 $90 订单分析');
    console.log('═'.repeat(120));
    console.log('');
    
    if (targetOrders.length > 0) {
      console.log(`   找到 ${targetOrders.length} 条金额接近 $90 的订单:\n`);
      targetOrders.forEach((order, idx) => {
        const calculatedPrice = order.filledAmount && order.filledAmount > 0
          ? order.amount / order.filledAmount
          : 0;
        console.log(`   ${idx + 1}. ${order.market.title}`);
        console.log(`      订单ID: ${order.id}`);
        console.log(`      金额: $${order.amount.toFixed(2)}`);
        console.log(`      成交份额: ${order.filledAmount || 'N/A'} shares`);
        console.log(`      计算出的成交价格: $${calculatedPrice.toFixed(4)}`);
        console.log(`      限价: ${order.limitPrice ? `$${order.limitPrice.toFixed(4)}` : 'N/A'}`);
        console.log(`      订单类型: ${order.orderType || 'MARKET'}`);
        console.log(`      状态: ${order.status}`);
        console.log('');
      });
    } else {
      console.log('   未找到金额接近 $90 的订单');
      console.log('');
    }

    // 汇总统计
    console.log('═'.repeat(120));
    console.log('📊 汇总统计');
    console.log('═'.repeat(120));
    console.log('');
    
    const marketOrders = orders.filter(o => o.orderType === 'MARKET' || !o.orderType);
    const limitOrders = orders.filter(o => o.orderType === 'LIMIT');
    const filledOrders = orders.filter(o => o.status === 'FILLED');
    const pendingOrders = orders.filter(o => o.status === 'PENDING');
    
    console.log(`   总订单数: ${orders.length}`);
    console.log(`   MARKET 订单: ${marketOrders.length}`);
    console.log(`   LIMIT 订单: ${limitOrders.length}`);
    console.log(`   已成交 (FILLED): ${filledOrders.length}`);
    console.log(`   待成交 (PENDING): ${pendingOrders.length}`);
    console.log('');

    // 计算所有订单的平均成交价格
    const prices = orders
      .map(o => {
        if (o.filledAmount && o.filledAmount > 0) {
          return o.amount / o.filledAmount;
        }
        return null;
      })
      .filter((p): p is number => p !== null && p > 0 && p <= 1);
    
    if (prices.length > 0) {
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      console.log(`   成交价格统计:`);
      console.log(`      - 平均值: $${avgPrice.toFixed(4)}`);
      console.log(`      - 最小值: $${minPrice.toFixed(4)}`);
      console.log(`      - 最大值: $${maxPrice.toFixed(4)}`);
    }
    
    console.log('\n');
    console.log('═'.repeat(120));
    console.log('✅ 查询完成');
    console.log('═'.repeat(120));

  } catch (error) {
    console.error('❌ 查询失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行查询
checkOrders()
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });

