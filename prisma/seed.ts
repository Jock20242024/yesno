/**
 * Prisma Seeder
 * 
 * 自动初始化最高权限管理员账户
 * 运行方式: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../services/authService';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始 Seeding...');

  // 定义最高权限 Admin 账户
  const adminEmail = 'yesno@yesno.com';
  const adminPassword = 'yesno2025';
  const isAdmin = true;

  // 哈希密码（强制等待 await）
  console.log('🔐 正在哈希管理员密码...');
  const passwordHash = await hashPassword(adminPassword);
  
  // 验证密码哈希是否生成成功
  if (!passwordHash || passwordHash.length === 0) {
    throw new Error('密码哈希失败：生成的哈希为空');
  }
  
  console.log(`✅ 密码哈希生成成功（长度: ${passwordHash.length}）`);

  // 使用 upsert 创建或更新管理员账户
  console.log('👤 正在创建/更新管理员账户...');
  const adminUser = await prisma.user.upsert({
    where: {
      email: adminEmail,
    },
    update: {
      passwordHash: passwordHash,
      isAdmin: isAdmin,
      isBanned: false,
    },
    create: {
      email: adminEmail,
      passwordHash: passwordHash,
      isAdmin: isAdmin,
      isBanned: false,
      balance: 0.0,
    },
  });

  console.log('✅ 管理员账户已创建/更新:');
  console.log(`   Email: ${adminUser.email}`);
  console.log(`   ID: ${adminUser.id}`);
  console.log(`   isAdmin: ${adminUser.isAdmin}`);
  console.log(`   passwordHash: ${adminUser.passwordHash.substring(0, 20)}...`);
  console.log('');
  
  // 验证：测试密码是否正确哈希
  console.log('🔍 验证密码哈希...');
  const { comparePassword } = await import('../services/authService');
  const passwordMatch = await comparePassword(adminPassword, adminUser.passwordHash);
  if (passwordMatch) {
    console.log('✅ 密码验证测试通过！');
  } else {
    console.error('❌ 密码验证测试失败！');
    throw new Error('密码哈希验证失败');
  }
  
  console.log('');
  console.log('🎉 Seeding 完成！');
}

main()
  .catch((e) => {
    console.error('❌ Seeding 失败:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

