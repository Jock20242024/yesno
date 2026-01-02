/**
 * 重置管理员密码脚本
 * 
 * 运行方式：npx tsx scripts/reset-admin-password.ts
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../services/authService';

const prisma = new PrismaClient();

async function main() {
  const email = 'guanliyuan@yesno.com';
  const newPassword = 'yesnoex.com2026'; // 新密码

  console.log('=== 重置管理员密码 ===\n');

  try {
    // 查找用户
    const user = await prisma.users.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        isAdmin: true,
      },
    });

    if (!user) {
      console.error(`❌ 用户不存在: ${email}`);
      process.exit(1);
    }

    console.log(`✅ 找到用户: ${user.email}`);
    console.log(`   是否管理员: ${user.isAdmin ? '是' : '否'}`);

    // 生成新密码哈希
    console.log('\n🔐 生成新密码哈希...');
    const passwordHash = await hashPassword(newPassword);
    console.log(`✅ 密码哈希已生成 (长度: ${passwordHash.length})`);

    // 更新密码
    console.log('\n💾 更新数据库...');
    await prisma.users.update({
      where: { id: user.id },
      data: {
        passwordHash: passwordHash,
        updatedAt: new Date(),
      },
    });

    console.log('✅ 密码已更新');
    console.log(`\n📋 新密码: ${newPassword}`);
    console.log('   请使用此密码登录');

    // 验证新密码
    console.log('\n🔍 验证新密码...');
    const { comparePassword } = await import('../services/authService');
    const updatedUser = await prisma.users.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (updatedUser?.passwordHash) {
      const isValid = await comparePassword(newPassword, updatedUser.passwordHash);
      if (isValid) {
        console.log('✅ 密码验证成功！');
      } else {
        console.error('❌ 密码验证失败！');
      }
    }

  } catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

