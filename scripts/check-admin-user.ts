/**
 * 临时脚本：检查数据库中的管理员账号数据
 * 运行方式: npx ts-node scripts/check-admin-user.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 检查数据库中的管理员账号数据...\n');

  try {
    // 查询所有管理员账号
    const adminUsers = await prisma.user.findMany({
      where: {
        isAdmin: true,
      },
      select: {
        id: true,
        email: true,
        isAdmin: true,
        isBanned: true,
        provider: true,
        balance: true,
        createdAt: true,
      },
    });

    console.log(`📊 找到 ${adminUsers.length} 个管理员账号:\n`);

    if (adminUsers.length === 0) {
      console.log('❌ 数据库中没有任何管理员账号！');
      console.log('💡 请运行: npx prisma db seed');
    } else {
      adminUsers.forEach((user, index) => {
        console.log(`管理员 #${index + 1}:`);
        console.log(`  📧 Email: ${user.email}`);
        console.log(`  🆔 ID: ${user.id}`);
        console.log(`  👑 isAdmin: ${user.isAdmin}`);
        console.log(`  🚫 isBanned: ${user.isBanned}`);
        console.log(`  🔐 Provider: ${user.provider}`);
        console.log(`  💰 Balance: ${user.balance}`);
        console.log(`  📅 Created: ${user.createdAt}`);
        console.log('');
      });
    }

    // 查询所有 Google 登录的用户
    const googleUsers = await prisma.user.findMany({
      where: {
        provider: 'google',
      },
      select: {
        email: true,
        isAdmin: true,
        provider: true,
      },
    });

    console.log(`\n📊 Google 登录用户 (共 ${googleUsers.length} 个):\n`);
    
    if (googleUsers.length === 0) {
      console.log('⚠️  数据库中没有任何 Google 登录用户');
    } else {
      googleUsers.forEach((user) => {
        console.log(`  📧 ${user.email} - isAdmin: ${user.isAdmin ? '✅ 是' : '❌ 否'}`);
      });
    }

    console.log('\n✅ 检查完成！');

  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
