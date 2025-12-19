/**
 * 检查 Category 表中的重复数据
 * 使用方法: node scripts/check-duplicate-categories.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDuplicates() {
  try {
    console.log('🔍 正在检查 Category 表中的重复数据...\n');

    // 获取所有分类
    const allCategories = await prisma.category.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    console.log(`📊 总共找到 ${allCategories.length} 个分类\n`);

    // 检查重复的名称
    const nameMap = new Map();
    const duplicateNames = [];
    
    allCategories.forEach(cat => {
      if (nameMap.has(cat.name)) {
        duplicateNames.push({
          name: cat.name,
          ids: [nameMap.get(cat.name), cat.id],
        });
      } else {
        nameMap.set(cat.name, cat.id);
      }
    });

    // 检查重复的 slug
    const slugMap = new Map();
    const duplicateSlugs = [];
    
    allCategories.forEach(cat => {
      if (slugMap.has(cat.slug)) {
        duplicateSlugs.push({
          slug: cat.slug,
          ids: [slugMap.get(cat.slug), cat.id],
        });
      } else {
        slugMap.set(cat.slug, cat.id);
      }
    });

    // 输出结果
    if (duplicateNames.length > 0) {
      console.log('❌ 发现重复的名称:');
      duplicateNames.forEach(dup => {
        console.log(`  名称: "${dup.name}" - IDs: ${dup.ids.join(', ')}`);
        const cats = allCategories.filter(c => dup.ids.includes(c.id));
        cats.forEach(c => {
          console.log(`    - ID: ${c.id}, Slug: ${c.slug}, ParentId: ${c.parentId || 'null'}, Status: ${c.status}`);
        });
      });
      console.log();
    } else {
      console.log('✅ 没有发现重复的名称\n');
    }

    if (duplicateSlugs.length > 0) {
      console.log('❌ 发现重复的 Slug:');
      duplicateSlugs.forEach(dup => {
        console.log(`  Slug: "${dup.slug}" - IDs: ${dup.ids.join(', ')}`);
        const cats = allCategories.filter(c => dup.ids.includes(c.id));
        cats.forEach(c => {
          console.log(`    - ID: ${c.id}, Name: ${c.name}, ParentId: ${c.parentId || 'null'}, Status: ${c.status}`);
        });
      });
      console.log();
    } else {
      console.log('✅ 没有发现重复的 Slug\n');
    }

    // 列出所有分类
    console.log('📋 所有分类列表:');
    allCategories.forEach(cat => {
      console.log(`  - ID: ${cat.id}`);
      console.log(`    名称: ${cat.name}`);
      console.log(`    Slug: ${cat.slug}`);
      console.log(`    父级ID: ${cat.parentId || 'null'}`);
      console.log(`    层级: ${cat.level}`);
      console.log(`    状态: ${cat.status}`);
      console.log();
    });

    // 如果有重复，提供清理建议
    if (duplicateNames.length > 0 || duplicateSlugs.length > 0) {
      console.log('💡 清理建议:');
      console.log('  如果发现测试数据或重复数据，可以通过以下 SQL 命令清理:');
      console.log('  (请谨慎操作，建议先备份数据库)\n');
      
      if (duplicateNames.length > 0) {
        console.log('  -- 删除重复名称的分类（保留第一个，删除后续的）:');
        duplicateNames.forEach((dup, index) => {
          const idsToDelete = dup.ids.slice(1); // 保留第一个，删除其他的
          idsToDelete.forEach(id => {
            console.log(`  DELETE FROM categories WHERE id = '${id}'; -- 删除重复的名称: ${dup.name}`);
          });
        });
        console.log();
      }

      if (duplicateSlugs.length > 0) {
        console.log('  -- 删除重复 Slug 的分类（保留第一个，删除后续的）:');
        duplicateSlugs.forEach((dup, index) => {
          const idsToDelete = dup.ids.slice(1); // 保留第一个，删除其他的
          idsToDelete.forEach(id => {
            console.log(`  DELETE FROM categories WHERE id = '${id}'; -- 删除重复的 Slug: ${dup.slug}`);
          });
        });
        console.log();
      }
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicates();
