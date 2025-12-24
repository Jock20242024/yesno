// 修复市场分类关联：将旧分类（slug: 15, 1, 4）更新为正确的分类（slug: 15m, 1h, 4h）
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 旧分类到新分类的映射
const categoryMapping = {
  '15': '15m',
  '1': '1h',
  '4': '4h'
};

async function fixMarketCategoryAssociations() {
  try {
    console.log('🔍 正在查找需要修复的市场分类关联...\n');
    
    for (const [oldSlug, newSlug] of Object.entries(categoryMapping)) {
      console.log(`处理分类映射: ${oldSlug} -> ${newSlug}`);
      
      // 查找旧分类
      const oldCategory = await prisma.category.findUnique({
        where: { slug: oldSlug }
      });
      
      if (!oldCategory) {
        console.log(`  ⏭️  旧分类 '${oldSlug}' 不存在，跳过\n`);
        continue;
      }
      
      // 查找新分类
      const newCategory = await prisma.category.findUnique({
        where: { slug: newSlug }
      });
      
      if (!newCategory) {
        console.log(`  ⚠️  新分类 '${newSlug}' 不存在，请先在后台创建此分类\n`);
        continue;
      }
      
      // 查找使用旧分类的市场
      const marketCategories = await prisma.marketCategory.findMany({
        where: { categoryId: oldCategory.id },
        include: {
          market: {
            select: {
              id: true,
              title: true,
              categorySlug: true
            }
          }
        }
      });
      
      if (marketCategories.length === 0) {
        console.log(`  ✅ 没有市场使用旧分类 '${oldSlug}'\n`);
        continue;
      }
      
      console.log(`  找到 ${marketCategories.length} 个市场使用旧分类:`);
      
      for (const mc of marketCategories) {
        // 检查是否已经有关联到新分类
        const existingAssociation = await prisma.marketCategory.findFirst({
          where: {
            marketId: mc.marketId,
            categoryId: newCategory.id
          }
        });
        
        if (existingAssociation) {
          console.log(`    - 市场 "${mc.market.title}" (${mc.market.id})`);
          console.log(`      已关联到新分类 '${newSlug}'，删除旧关联`);
          // 删除旧关联
          await prisma.marketCategory.delete({
            where: { id: mc.id }
          });
        } else {
          console.log(`    - 市场 "${mc.market.title}" (${mc.market.id})`);
          console.log(`      更新关联: ${oldSlug} -> ${newSlug}`);
          
          // 更新关联：删除旧的，创建新的
          await prisma.marketCategory.delete({
            where: { id: mc.id }
          });
          
          await prisma.marketCategory.create({
            data: {
              marketId: mc.marketId,
              categoryId: newCategory.id
            }
          });
          
          // 更新市场的 categorySlug 字段
          await prisma.market.update({
            where: { id: mc.marketId },
            data: {
              categorySlug: newSlug
            }
          });
        }
      }
      
      console.log(`  ✅ 完成处理 '${oldSlug}' -> '${newSlug}'\n`);
    }
    
    console.log('✅ 所有市场分类关联修复完成！');
    
  } catch (error) {
    console.error('❌ 修复市场分类关联时出错:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixMarketCategoryAssociations();
