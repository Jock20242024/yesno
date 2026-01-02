/**
 * 导出分类数据脚本
 * 用于从本地数据库导出分类数据（包括子分类），然后可以导入到云端
 * 
 * 运行方式: npx tsx scripts/export-categories.ts > categories-export.json
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// 加载本地环境变量（用于连接本地数据库）
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

async function main() {
  console.log('=== 导出分类数据 ===\n');

  try {
    const categories = await prisma.categories.findMany({
      include: {
        categories: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        other_categories: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            displayOrder: true,
            sortOrder: true,
            level: true,
            status: true,
            parentId: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const exportData = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      displayOrder: cat.displayOrder,
      sortOrder: cat.sortOrder,
      level: cat.level,
      status: cat.status,
      parentId: cat.parentId,
      parent: cat.categories ? {
        id: cat.categories.id,
        name: cat.categories.name,
        slug: cat.categories.slug,
      } : null,
      children: cat.other_categories?.map(child => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        icon: child.icon,
        displayOrder: child.displayOrder,
        sortOrder: child.sortOrder,
        level: child.level,
        status: child.status,
        parentId: child.parentId,
      })) || [],
    }));

    console.log(JSON.stringify(exportData, null, 2));

    const topLevelCount = exportData.filter(c => !c.parentId).length;
    const childCount = exportData.filter(c => c.parentId).length;

    console.error(`\n✅ 导出完成：`);
    console.error(`   顶级分类: ${topLevelCount} 个`);
    console.error(`   子分类: ${childCount} 个`);
    console.error(`   总计: ${exportData.length} 个分类`);
  } catch (error: any) {
    console.error('❌ 导出失败:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

