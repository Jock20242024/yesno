/**
 * 🔥 紧急修复脚本：数据初始化与管理员重置
 * 
 * 修复内容：
 * 1. 修复分类数据（确保 crypto, politics, sports, finance, tech 存在）
 * 2. 重置/创建管理员账号（admin@admin.com / admin123）
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';
import bcrypt from 'bcryptjs';

// 加载环境变量
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

// 分类配置
const CATEGORIES = [
  { name: '加密货币', slug: 'crypto', displayOrder: 1 },
  { name: '政治', slug: 'politics', displayOrder: 2 },
  { name: '体育', slug: 'sports', displayOrder: 3 },
  { name: '金融', slug: 'finance', displayOrder: 4 },
  { name: '科技', slug: 'tech', displayOrder: 5 },
];

async function fixCategories() {
  console.log('🔧 [Fix All Data] 开始修复分类数据...\n');

  let createdCount = 0;
  let updatedCount = 0;

  for (const categoryData of CATEGORIES) {
    try {
      // 使用 upsert 确保分类存在
      const category = await prisma.category.upsert({
        where: { slug: categoryData.slug },
        update: {
          name: categoryData.name,
          displayOrder: categoryData.displayOrder,
          status: 'active',
          level: 0, // 顶级分类
        },
        create: {
          name: categoryData.name,
          slug: categoryData.slug,
          displayOrder: categoryData.displayOrder,
          status: 'active',
          level: 0, // 顶级分类
        },
      });

      if (category.createdAt.getTime() === category.updatedAt.getTime()) {
        createdCount++;
        console.log(`  ✅ 创建分类: ${categoryData.name} (${categoryData.slug})`);
      } else {
        updatedCount++;
        console.log(`  🔄 更新分类: ${categoryData.name} (${categoryData.slug})`);
      }
    } catch (error: any) {
      console.error(`  ❌ 处理分类失败 (${categoryData.slug}): ${error.message}`);
    }
  }

  console.log(`\n📊 [Fix All Data] 分类修复完成: 创建 ${createdCount} 个, 更新 ${updatedCount} 个\n`);
}

async function fixAdmin() {
  console.log('🔧 [Fix All Data] 开始修复管理员账号...\n');

  const adminEmail = 'admin@admin.com';
  const adminPassword = 'admin123';

  try {
    // 加密密码
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    // 查找或创建管理员
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      // 如果存在，强制重置密码和权限
      await prisma.user.update({
        where: { email: adminEmail },
        data: {
          passwordHash: passwordHash,
          isAdmin: true,
          isBanned: false,
        },
      });
      console.log(`  🔄 管理员账号已重置: ${adminEmail}`);
    } else {
      // 如果不存在，创建新管理员
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: passwordHash,
          provider: 'email',
          isAdmin: true,
          isBanned: false,
          balance: 0.0,
        },
      });
      console.log(`  ✅ 管理员账号已创建: ${adminEmail}`);
    }

    console.log(`\n📊 [Fix All Data] 管理员账号信息:`);
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Password: ${adminPassword}`);
    console.log(`  Role: ADMIN\n`);
  } catch (error: any) {
    console.error(`  ❌ 修复管理员账号失败: ${error.message}`);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 [Fix All Data] 开始执行综合修复...\n');
    console.log('=' .repeat(60));
    console.log('');

    // 1. 修复分类
    await fixCategories();

    // 2. 修复管理员
    await fixAdmin();

    console.log('=' .repeat(60));
    console.log('✅ [Fix All Data] 所有修复完成！\n');
    console.log('✅ 分类数据已修复');
    console.log('✅ 管理员账号已重置: admin@admin.com / admin123\n');

  } catch (error: any) {
    console.error(`\n❌ [Fix All Data] 执行失败: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行修复
main()
  .then(() => {
    console.log('✅ [Fix All Data] 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ [Fix All Data] 脚本执行失败:', error);
    process.exit(1);
  });
