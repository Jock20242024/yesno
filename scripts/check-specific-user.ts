/**
 * 检查特定用户的 isAdmin 状态
 * 运行方式: npx ts-node scripts/check-specific-user.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targetEmail = 'npc.ventures86@gmail.com';
  
  console.log(`🔍 检查用户: ${targetEmail}\n`);

  try {
    const user = await prisma.user.findUnique({
      where: { email: targetEmail },
      select: {
        id: true,
        email: true,
        isAdmin: true,
        isBanned: true,
        provider: true,
        balance: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      console.log(`❌ 用户 ${targetEmail} 不存在于数据库中`);
      return;
    }

    console.log('📊 用户信息:');
    console.log(`  📧 Email: ${user.email}`);
    console.log(`  🆔 ID: ${user.id}`);
    console.log(`  👑 isAdmin: ${user.isAdmin} ${user.isAdmin === true ? '✅' : '❌'}`);
    console.log(`  🚫 isBanned: ${user.isBanned}`);
    console.log(`  🔐 Provider: ${user.provider}`);
    console.log(`  💰 Balance: ${user.balance}`);
    console.log(`  📅 Created: ${user.createdAt}`);
    console.log(`  📅 Updated: ${user.updatedAt}`);
    console.log('');

    if (user.isAdmin === true) {
      console.log('✅ 确认：该用户是管理员（isAdmin = true）');
    } else {
      console.log('❌ 警告：该用户不是管理员（isAdmin = false 或 undefined）');
      console.log('');
      console.log('💡 如果需要将该用户设置为管理员，可以运行以下 SQL:');
      console.log(`   UPDATE users SET "isAdmin" = true WHERE email = '${targetEmail}';`);
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
