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
  console.log(`   passwordHash: ${adminUser.passwordHash?.substring(0, 20) || 'null'}...`);
  console.log('');
  
  // 验证：测试密码是否正确哈希
  if (!adminUser.passwordHash) {
    throw new Error('管理员密码哈希为空');
  }
  
  console.log('🔍 验证密码哈希...');
  const { comparePassword } = await import('../services/authService');
  const passwordMatch = await comparePassword(adminPassword, adminUser.passwordHash);
  if (passwordMatch) {
    console.log('✅ 密码验证测试通过！');
  } else {
    console.error('❌ 密码验证测试失败！');
    throw new Error('密码哈希验证失败');
  }
  
  // ========== 初始化分类数据 ==========
  console.log('');
  console.log('📋 开始初始化分类数据...');
  
  const defaultCategories = [
    { name: '加密货币', slug: 'crypto', icon: 'Bitcoin', displayOrder: 0 },
    { name: '政治', slug: 'politics', icon: 'Building2', displayOrder: 1 },
    { name: '体育', slug: 'sports', icon: 'Trophy', displayOrder: 2 },
    { name: '金融', slug: 'finance', icon: 'DollarSign', displayOrder: 3 },
    { name: '科技', slug: 'technology', icon: 'Cpu', displayOrder: 4 },
  ];

  for (const categoryData of defaultCategories) {
    const category = await prisma.category.upsert({
      where: {
        slug: categoryData.slug,
      },
      update: {
        name: categoryData.name,
        icon: categoryData.icon,
        displayOrder: categoryData.displayOrder,
        status: 'active',
      },
      create: {
        name: categoryData.name,
        slug: categoryData.slug,
        icon: categoryData.icon,
        displayOrder: categoryData.displayOrder,
        status: 'active',
      },
    });
    console.log(`  ✅ 分类已创建/更新: ${category.name} (${category.slug})`);
  }
  
  console.log(`✅ 分类数据初始化完成！共 ${defaultCategories.length} 个分类`);
  
  // ========== 初始化全局指标数据 ==========
  console.log('');
  console.log('📊 开始初始化全局指标数据...');
  
  const defaultStats = [
    { label: '24H 交易量', value: 0, unit: 'USD', icon: 'DollarSign', sortOrder: 0 },
    { label: '全网持仓量', value: 0, unit: '', icon: 'Activity', sortOrder: 1 },
    { label: '总锁仓量 (TVL)', value: 0, unit: 'USD', icon: 'TrendingUp', sortOrder: 2 },
    { label: '24H 活跃交易者', value: 0, unit: '人', icon: 'Users', sortOrder: 3 },
    { label: '进行中事件', value: 0, unit: '个', icon: 'BarChart', sortOrder: 4 },
  ];

  for (const statData of defaultStats) {
    // 检查是否已存在相同 label 的指标
    const existing = await prisma.globalStat.findFirst({
      where: { label: statData.label },
    });

    if (existing) {
      // 如果已存在，只更新值（保留用户可能已修改的值）
      console.log(`  ⏭️  指标已存在，跳过: ${statData.label}`);
    } else {
      const stat = await prisma.globalStat.create({
        data: {
          label: statData.label,
          value: statData.value,
          unit: statData.unit,
          icon: statData.icon,
          sortOrder: statData.sortOrder,
          isActive: true,
        },
      });
      console.log(`  ✅ 全局指标已创建: ${stat.label}`);
    }
  }
  
  console.log(`✅ 全局指标数据初始化完成！`);
  
  // ========== 标记热门市场 ==========
  console.log('');
  console.log('🔥 开始标记热门市场...');
  
  // 获取前 5 个开放的市场，按交易量排序
  const openMarkets = await prisma.market.findMany({
    where: {
      status: 'OPEN',
    },
    orderBy: {
      totalVolume: 'desc',
    },
    take: 5,
  });
  
  if (openMarkets.length > 0) {
    let markedCount = 0;
    for (const market of openMarkets) {
      await prisma.market.update({
        where: { id: market.id },
        data: { isHot: true },
      });
      console.log(`  ✅ 标记为热门: ${market.title} (ID: ${market.id})`);
      markedCount++;
    }
    console.log(`✅ 已标记 ${markedCount} 个热门市场！`);
  } else {
    console.log('  ⚠️  没有找到开放的市场，无法标记热门市场');
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

