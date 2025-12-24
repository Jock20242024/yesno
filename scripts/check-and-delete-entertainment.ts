/**
 * 检查并删除数据库中的 entertainment（娱乐）分类
 * 运行方式: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/check-and-delete-entertainment.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 开始检查数据库中的分类...\n');

  try {
    // 查找所有分类
    const allCategories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    console.log(`📊 数据库中共有 ${allCategories.length} 个分类：\n`);
    allCategories.forEach((cat, index) => {
      console.log(`${index + 1}. ${cat.name} (slug: ${cat.slug}, status: ${cat.status})`);
    });

    // 查找 entertainment 相关的分类
    const entertainmentCategories = await prisma.category.findMany({
      where: {
        OR: [
          { slug: 'entertainment' },
          { name: { contains: '娱乐' } },
        ],
      },
      include: {
        markets: {
          select: {
            id: true,
          },
        },
      },
    });

    if (entertainmentCategories.length === 0) {
      console.log('\n✅ 未找到 entertainment 或"娱乐"相关的分类，数据库干净！');
      return;
    }

    console.log(`\n🗑️  找到 ${entertainmentCategories.length} 个需要删除的分类：\n`);
    
    for (const cat of entertainmentCategories) {
      console.log(`- ${cat.name} (slug: ${cat.slug})`);
      console.log(`  关联市场数量: ${cat.markets.length}`);
      
      if (cat.markets.length > 0) {
        console.log(`  ⚠️  警告：该分类还有 ${cat.markets.length} 个关联的市场。`);
      }
    }

    console.log('\n准备删除这些分类...');
    
    for (const cat of entertainmentCategories) {
      await prisma.category.delete({
        where: {
          id: cat.id,
        },
      });
      console.log(`✅ 已删除: ${cat.name} (${cat.slug})`);
    }

    console.log(`\n✅ 成功删除 ${entertainmentCategories.length} 个分类！`);
  } catch (error) {
    console.error('❌ 操作失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
