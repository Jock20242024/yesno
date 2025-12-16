/**
 * E2E 测试数据库验证脚本
 * 直接查询数据库验证余额和状态
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const testUserEmail = 'testuser@verify.com';
const marketTitle = 'E2E测试市场M1';

async function verifyDatabase() {
  console.log('\n========================================');
  console.log('   E2E 测试 - 数据库验证');
  console.log('========================================\n');

  try {
    // 查找测试用户
    const user = await prisma.user.findUnique({
      where: { email: testUserEmail },
      include: {
        orders: true,
        deposits: true,
        withdrawals: true,
      },
    });

    if (!user) {
      console.log('❌ 测试用户不存在');
      return;
    }

    console.log('=== 用户信息 ===');
    console.log(`邮箱: ${user.email}`);
    console.log(`用户 ID: ${user.id}`);
    console.log(`余额: $${user.balance.toFixed(2)}`);
    console.log(`是否管理员: ${user.isAdmin}`);

    // 场景 2 验证：余额应该是 $1000.00（如果只完成了充值）
    console.log('\n=== 场景 2 验证：充值 $1000 ===');
    const deposits = user.deposits || [];
    const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);
    console.log(`充值总额: $${totalDeposits.toFixed(2)}`);
    console.log(`预期余额（仅充值）: $1000.00`);
    console.log(`实际余额: $${user.balance.toFixed(2)}`);

    // 查找市场
    const market = await prisma.market.findFirst({
      where: { title: { contains: marketTitle } },
      include: {
        orders: true,
      },
    });

    if (market) {
      console.log('\n=== 市场信息 ===');
      console.log(`市场 ID: ${market.id}`);
      console.log(`标题: ${market.title}`);
      console.log(`状态: ${market.status}`);
      console.log(`总交易量: $${market.totalVolume.toFixed(2)}`);
      console.log(`总 YES: $${market.totalYes.toFixed(2)}`);
      console.log(`总 NO: $${market.totalNo.toFixed(2)}`);
      console.log(`费率: ${(market.feeRate * 100).toFixed(0)}%`);
      if (market.resolvedOutcome) {
        console.log(`结算结果: ${market.resolvedOutcome}`);
      }

      // 查找用户的订单
      const userOrders = market.orders.filter(o => o.userId === user.id);
      console.log(`\n用户订单数: ${userOrders.length}`);
      userOrders.forEach((order, idx) => {
        console.log(`\n订单 ${idx + 1}:`);
        console.log(`  ID: ${order.id}`);
        console.log(`  选项: ${order.outcomeSelection}`);
        console.log(`  金额: $${order.amount.toFixed(2)}`);
        console.log(`  手续费: $${order.feeDeducted.toFixed(2)}`);
        if (order.payout !== null) {
          console.log(`  收益: $${order.payout.toFixed(2)}`);
        }
      });
    }

    // 提现记录
    const withdrawals = user.withdrawals || [];
    console.log('\n=== 提现记录 ===');
    console.log(`提现总数: ${withdrawals.length}`);
    withdrawals.forEach((w, idx) => {
      console.log(`\n提现 ${idx + 1}:`);
      console.log(`  ID: ${w.id}`);
      console.log(`  金额: $${w.amount.toFixed(2)}`);
      console.log(`  状态: ${w.status}`);
      console.log(`  时间: ${w.createdAt.toISOString()}`);
    });

    // 最终余额验证
    console.log('\n=== 最终余额验证 ===');
    console.log(`当前余额: $${user.balance.toFixed(2)}`);
    console.log('\n预期余额（按场景）:');
    console.log('  场景 2 (充值后): $1000.00');
    console.log('  场景 3-4 (下注+提现后): $400.00');
    console.log('  场景 5 (清算后): $495.00');
    console.log('  场景 6 (审批后): $495.00 (保持不变)');

    // 计算验证
    let calculatedBalance = 0;
    const totalDeposit = deposits.reduce((sum, d) => sum + (d.status === 'COMPLETED' ? d.amount : 0), 0);
    const totalOrder = userOrders.reduce((sum, o) => sum + o.amount, 0);
    const totalWithdrawal = withdrawals.reduce((sum, w) => {
      if (w.status === 'COMPLETED') return sum + w.amount;
      if (w.status === 'PENDING') return sum + w.amount; // 提现时已扣除
      return sum;
    }, 0);
    const totalPayout = userOrders.reduce((sum, o) => sum + (o.payout || 0), 0);

    calculatedBalance = totalDeposit - totalOrder - totalWithdrawal + totalPayout;

    console.log('\n=== 余额计算验证 ===');
    console.log(`充值总额: $${totalDeposit.toFixed(2)}`);
    console.log(`订单总额: $${totalOrder.toFixed(2)}`);
    console.log(`提现总额: $${totalWithdrawal.toFixed(2)}`);
    console.log(`收益总额: $${totalPayout.toFixed(2)}`);
    console.log(`计算余额: $${calculatedBalance.toFixed(2)}`);
    console.log(`实际余额: $${user.balance.toFixed(2)}`);
    
    if (Math.abs(calculatedBalance - user.balance) < 0.01) {
      console.log('✅ 余额计算正确！');
    } else {
      console.log('⚠️  余额计算有差异');
    }

  } catch (error) {
    console.error('❌ 数据库验证失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDatabase();

