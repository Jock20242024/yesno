// 清理冗余分类：删除那些 slug 是 15、1、4 的旧分类
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupOldCategories() {
  try {
    console.log('🔍 正在查找需要清理的旧分类（slug: 15, 1, 4）...');
    
    // 查找 slug 为 15, 1, 4 的分类
    const oldSlugs = ['15', '1', '4'];
    const oldCategories = await prisma.category.findMany({
      where: {
        slug: {
          in: oldSlugs
        }
      }
    });
    
    if (oldCategories.length === 0) {
      console.log('✅ 没有找到需要清理的旧分类（slug: 15, 1, 4）');
      return;
    }
    
    console.log(`\n找到 ${oldCategories.length} 个需要清理的旧分类：`);
    
    // 检查每个分类的市场关联
    for (const cat of oldCategories) {
      const marketCount = await prisma.marketCategory.count({
        where: {
          categoryId: cat.id
        }
      });
      
      console.log(`  - ID: ${cat.id}`);
      console.log(`    Slug: ${cat.slug}, Name: ${cat.name}`);
      console.log(`    关联市场数: ${marketCount}`);
      
      if (marketCount > 0) {
        // 查询关联的市场
        const markets = await prisma.marketCategory.findMany({
          where: { categoryId: cat.id },
          include: { market: { select: { id: true, title: true } } }
        });
        console.log(`    关联的市场:`);
        markets.forEach(mc => {
          console.log(`      - ${mc.market.id}: ${mc.market.title}`);
        });
      }
    }
    
    // 删除没有市场关联的旧分类
    console.log('\n🗑️  正在删除没有市场关联的旧分类...');
    
    let deletedCount = 0;
    for (const cat of oldCategories) {
      const marketCount = await prisma.marketCategory.count({
        where: { categoryId: cat.id }
      });
      
      if (marketCount === 0) {
        await prisma.category.delete({
          where: { id: cat.id }
        });
        console.log(`  ✅ 已删除: ${cat.slug} (${cat.name})`);
        deletedCount++;
      } else {
        console.log(`  ⚠️  跳过: ${cat.slug} (${cat.name}) - 仍有 ${marketCount} 个关联市场`);
      }
    }
    
    console.log(`\n✅ 共删除 ${deletedCount} 个旧分类`);
    
    if (deletedCount < oldCategories.length) {
      console.log('\n⚠️  提示：仍有部分旧分类有关联的市场，需要手动处理：');
      console.log('   1. 将这些市场的分类关联更新为正确的分类（如 15m）');
      console.log('   2. 然后重新运行此脚本删除旧分类');
    }
    
  } catch (error) {
    console.error('❌ 清理旧分类时出错:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOldCategories();
