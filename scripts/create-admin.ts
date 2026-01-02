/**
 * 创建管理员用户脚本
 * 
 * 使用方法：
 * npx tsx scripts/create-admin.ts <email> <password>
 * 
 * 示例：
 * npx tsx scripts/create-admin.ts admin@example.com admin123
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../services/authService';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function createAdmin() {
  // 从命令行参数获取邮箱和密码
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('❌ 错误：请提供邮箱和密码');
    console.log('');
    console.log('使用方法：');
    console.log('  npx tsx scripts/create-admin.ts <email> <password>');
    console.log('');
    console.log('示例：');
    console.log('  npx tsx scripts/create-admin.ts admin@example.com admin123');
    process.exit(1);
  }

  try {
    // 检查用户是否已存在
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      // 如果用户已存在，更新为管理员
      console.log(`⚠️  用户 ${email} 已存在，正在更新为管理员...`);
      
      const passwordHash = await hashPassword(password);
      
      const updatedUser = await prisma.users.update({
        where: { email },
        data: {
          isAdmin: true,
          passwordHash: passwordHash, // 更新密码
          updatedAt: new Date(),
        },
      });

      console.log('✅ 管理员用户已更新！');
      console.log('');
      console.log('用户信息：');
      console.log(`  ID: ${updatedUser.id}`);
      console.log(`  邮箱: ${updatedUser.email}`);
      console.log(`  是否管理员: ${updatedUser.isAdmin}`);
      console.log(`  余额: ${updatedUser.balance}`);
    } else {
      // 创建新管理员用户
      console.log(`正在创建管理员用户: ${email}...`);
      
      const passwordHash = await hashPassword(password);
      
      const newUser = await prisma.users.create({
        data: {
          id: randomUUID(),
          email,
          passwordHash,
          provider: 'email',
          balance: 0.0,
          isAdmin: true, // 🔥 设置为管理员
          isBanned: false,
          updatedAt: new Date(),
        },
      });

      console.log('✅ 管理员用户已创建！');
      console.log('');
      console.log('用户信息：');
      console.log(`  ID: ${newUser.id}`);
      console.log(`  邮箱: ${newUser.email}`);
      console.log(`  是否管理员: ${newUser.isAdmin}`);
      console.log(`  余额: ${newUser.balance}`);
    }

    console.log('');
    console.log('现在可以使用以下凭据登录后台：');
    console.log(`  邮箱: ${email}`);
    console.log(`  密码: ${password}`);
    console.log(`  后台地址: http://localhost:3000/admin/login`);
  } catch (error) {
    console.error('❌ 创建管理员用户失败:', error);
    if (error instanceof Error) {
      console.error('错误详情:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();

