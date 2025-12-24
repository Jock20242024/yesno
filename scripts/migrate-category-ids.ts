/**
 * 数据库洗牌脚本：将 Category 表中所有非 UUID 格式的 ID 转换为标准 UUID
 * 
 * 执行方式：npx tsx scripts/migrate-category-ids.ts
 * 
 * 注意：此脚本使用原生 SQL 直接更新 ID，因为 Prisma 不支持更新主键
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

// UUID 正则表达式
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function migrateCategoryIds() {
  try {
    console.log('\n🔄 ========== 开始迁移 Category ID ==========\n');

    // 1. 查找所有非 UUID 格式的分类
    const allCategories = await prisma.category.findMany({});
    const nonUuidCategories = allCategories.filter(
      cat => !UUID_REGEX.test(cat.id)
    );

    if (nonUuidCategories.length === 0) {
      console.log('✅ 所有分类 ID 已经是 UUID 格式，无需迁移');
      await prisma.$disconnect();
      return;
    }

    console.log(`📊 发现 ${nonUuidCategories.length} 个非 UUID 格式的分类 ID:`);
    nonUuidCategories.forEach(cat => {
      console.log(`  - id: '${cat.id}', name: '${cat.name}', slug: '${cat.slug}'`);
    });

    // 2. 检查关联关系
    const oldIds = nonUuidCategories.map(cat => cat.id);
    const [marketCategories, childCategories] = await Promise.all([
      prisma.marketCategory.findMany({
        where: { categoryId: { in: oldIds } },
      }),
      prisma.category.findMany({
        where: { parentId: { in: oldIds } },
      }),
    ]);

    console.log(`\n📊 关联关系统计:`);
    console.log(`  - MarketCategory 关联记录: ${marketCategories.length} 条`);
    console.log(`  - Category 子分类（parentId 引用）: ${childCategories.length} 条`);

    // 3. 生成 ID 映射表
    const idMapping = new Map<string, string>();
    nonUuidCategories.forEach(cat => {
      idMapping.set(cat.id, randomUUID());
    });

    console.log('\n🔄 开始迁移（使用安全的多步骤方法）...\n');

    // 4. 使用事务，通过创建新分类→更新引用→删除旧分类的方式迁移
    await prisma.$transaction(async (tx) => {
      for (const [oldId, newId] of idMapping.entries()) {
        const category = nonUuidCategories.find(cat => cat.id === oldId);
        if (!category) continue;

        console.log(`迁移: '${oldId}' (${category.name}) → ${newId}`);

        try {
          // 4.1 创建新分类（使用新 ID 和临时名称避免唯一约束冲突）
          const tempName = `${category.name}_TEMP_${Date.now()}`;
          const tempSlug = `${category.slug}_temp_${Date.now()}`;
          
          await tx.category.create({
            data: {
              id: newId,
              name: tempName,
              slug: tempSlug,
              icon: category.icon,
              displayOrder: category.displayOrder,
              sortOrder: category.sortOrder,
              status: category.status,
              level: category.level,
              parentId: category.parentId && idMapping.has(category.parentId) 
                ? idMapping.get(category.parentId)! 
                : category.parentId, // 如果 parentId 也需要迁移，使用新 ID
              createdAt: category.createdAt,
              updatedAt: new Date(),
            },
          });
          console.log(`  ✅ 已创建新分类 (临时名称: ${tempName})`);

          // 4.2 更新 MarketCategory 表中的 categoryId
          const affectedMC = marketCategories.filter(mc => mc.categoryId === oldId).length;
          if (affectedMC > 0) {
            await tx.marketCategory.updateMany({
              where: { categoryId: oldId },
              data: { categoryId: newId },
            });
            console.log(`  ✅ 已更新 ${affectedMC} 条 MarketCategory 记录`);
          }

          // 4.3 更新 Category 表中的 parentId
          const affectedChild = childCategories.filter(cat => cat.parentId === oldId).length;
          if (affectedChild > 0) {
            await tx.category.updateMany({
              where: { parentId: oldId },
              data: { parentId: newId },
            });
            console.log(`  ✅ 已更新 ${affectedChild} 条 Category parentId`);
          }

          // 4.4 删除旧分类
          await tx.category.delete({
            where: { id: oldId },
          });
          console.log(`  ✅ 已删除旧分类`);

          // 4.5 更新新分类的名称和 slug 为原始值
          await tx.category.update({
            where: { id: newId },
            data: {
              name: category.name,
              slug: category.slug,
            },
          });
          console.log(`  ✅ 已恢复原始名称和 slug`);

          console.log(`  ✅ 分类迁移完成\n`);
        } catch (error: any) {
          console.error(`  ❌ 迁移失败:`, error.message);
          throw error;
        }
      }
    });

    // 5. 检查是否还有非 UUID 的 parentId（可能父分类已迁移，需要更新引用）
    const remainingCategories = await prisma.category.findMany({});
    const remainingNonUuidParentIds = remainingCategories.filter(
      cat => cat.parentId && !UUID_REGEX.test(cat.parentId)
    );

    if (remainingNonUuidParentIds.length > 0) {
      console.log(`\n⚠️ 发现 ${remainingNonUuidParentIds.length} 个分类的 parentId 仍是非 UUID 格式`);
      console.log('这些 parentId 应该已经在迁移过程中被更新，但让我们验证一下...');
      
      // 尝试从映射表中查找新的 parentId
      for (const cat of remainingNonUuidParentIds) {
        const newParentId = idMapping.get(cat.parentId!);
        if (newParentId) {
          await prisma.category.update({
            where: { id: cat.id },
            data: { parentId: newParentId },
          });
          console.log(`  ✅ 已更新分类 '${cat.name}' 的 parentId: ${cat.parentId} → ${newParentId}`);
        } else {
          console.log(`  ⚠️ 分类 '${cat.name}' 的 parentId '${cat.parentId}' 不在迁移列表中`);
        }
      }
    }

    console.log('\n✅ ========== Category ID 迁移完成 ==========\n');

    // 5. 验证结果
    const finalCategories = await prisma.category.findMany({});
    const finalNonUuidCategories = finalCategories.filter(
      cat => !UUID_REGEX.test(cat.id)
    );

    if (finalNonUuidCategories.length === 0) {
      console.log('✅ 验证通过：所有分类 ID 现在都是 UUID 格式');
    } else {
      console.log(`❌ 验证失败：仍有 ${finalNonUuidCategories.length} 个分类 ID 不是 UUID 格式`);
      finalNonUuidCategories.forEach(cat => {
        console.log(`  - id: '${cat.id}', name: '${cat.name}'`);
      });
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

migrateCategoryIds();
