#!/bin/bash

# 验证用户余额脚本
# 使用方法: ./scripts/verify-balance.sh testuser@verify.com

USER_EMAIL=${1:-"testuser@verify.com"}

export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/yesno_db?schema=public"

echo "=== 验证用户余额 ==="
echo "用户: $USER_EMAIL"
echo ""

export USER_EMAIL="$USER_EMAIL"

node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const userEmail = process.env.USER_EMAIL || 'testuser@verify.com';
    
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        deposits: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        withdrawals: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!user) {
      console.log('❌ 用户 ' + userEmail + ' 不存在');
      process.exit(1);
    }

    console.log('✅ 用户信息:');
    console.log('   Email: ' + user.email);
    console.log('   余额: $' + user.balance.toFixed(2));
    console.log('   是否管理员: ' + (user.isAdmin ? '是' : '否'));
    console.log('');

    // 计算交易汇总
    const totalDeposits = user.deposits.reduce((sum, d) => sum + d.amount, 0);
    const totalWithdrawals = user.withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const totalBets = user.orders.reduce((sum, o) => sum + o.amount, 0);
    const totalPayouts = user.orders.reduce((sum, o) => sum + (o.payout || 0), 0);

    console.log('📊 交易汇总:');
    console.log('   总充值: $' + totalDeposits.toFixed(2));
    console.log('   总提现: $' + totalWithdrawals.toFixed(2));
    console.log('   总下注: $' + totalBets.toFixed(2));
    console.log('   总收益: $' + totalPayouts.toFixed(2));
    console.log('');

    // 显示最近的订单
    if (user.orders.length > 0) {
      console.log('📝 最近的订单:');
      user.orders.forEach((order, i) => {
        const payoutStr = order.payout ? ' -> 收益: $' + order.payout.toFixed(2) : '';
        console.log('   ' + (i + 1) + '. ' + order.outcomeSelection + ' $' + order.amount.toFixed(2) + ' (手续费: $' + order.feeDeducted.toFixed(2) + ')' + payoutStr);
      });
      console.log('');
    }

    // 显示最近的充值
    if (user.deposits.length > 0) {
      console.log('💰 最近的充值:');
      user.deposits.forEach((deposit, i) => {
        console.log('   ' + (i + 1) + '. $' + deposit.amount.toFixed(2) + ' - ' + deposit.status);
      });
      console.log('');
    }

    // 显示最近的提现
    if (user.withdrawals.length > 0) {
      console.log('💸 最近的提现:');
      user.withdrawals.forEach((withdrawal, i) => {
        console.log('   ' + (i + 1) + '. $' + withdrawal.amount.toFixed(2) + ' - ' + withdrawal.status);
      });
      console.log('');
    }

    // 余额验证
    const expectedBalance = totalDeposits - totalWithdrawals - totalBets + totalPayouts;
    if (Math.abs(user.balance - expectedBalance) < 0.01) {
      console.log('✅ 余额验证通过');
    } else {
      console.log('⚠️  余额验证: 实际余额 ($' + user.balance.toFixed(2) + ') 与预期余额 ($' + expectedBalance.toFixed(2) + ') 不匹配');
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  } finally {
    await prisma.\$disconnect();
  }
})();
"
