/**
 * 导入分类数据脚本
 * 从导出的 JSON 文件导入分类数据到云端数据库
 * 
 * 运行方式: 
 *   1. 先导出: npx tsx scripts/export-categories.ts > categories-export.json
 *   2. 再导入: NODE_ENV=production npx tsx scripts/import-categories.ts < categories-export.json
 * 
 * 或者直接传入文件路径:
 *   NODE_ENV=production npx tsx scripts/import-categories.ts categories-export.json
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

async function main() {
  console.log('=== 导入分类数据 ===\n');

  try {
    // 读取 JSON 数据
    const filePath = process.argv[2] || '/dev/stdin';
    let jsonData: string;
    
    if (filePath === '/dev/stdin') {
      // 从标准输入读取
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      jsonData = Buffer.concat(chunks).toString('utf-8');
    } else {
      // 从文件读取
      jsonData = readFileSync(filePath, 'utf-8');
    }

    // 🔥 清理 JSON 数据：移除可能的日志输出
    // 查找第一个 [ 和最后一个 ] 之间的内容
    const startIndex = jsonData.indexOf('[');
    const lastIndex = jsonData.lastIndexOf(']');
    
    if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
      jsonData = jsonData.substring(startIndex, lastIndex + 1);
    }

    const categories = JSON.parse(jsonData);

    console.log(`读取到 ${categories.length} 个分类\n`);

    // 先导入顶级分类（parentId 为 null）
    const topLevelCategories = categories.filter((c: any) => !c.parentId);
    const childCategories = categories.filter((c: any) => c.parentId);

    console.log(`顶级分类: ${topLevelCategories.length} 个`);
    console.log(`子分类: ${childCategories.length} 个\n`);

    let importedTopLevel = 0;
    let importedChildren = 0;
    let skipped = 0;

    // 导入顶级分类
    for (const cat of topLevelCategories) {
      try {
        await prisma.categories.upsert({
          where: { id: cat.id },
          update: {
            name: cat.name,
            slug: cat.slug,
            icon: cat.icon,
            displayOrder: cat.displayOrder,
            sortOrder: cat.sortOrder,
            level: cat.level || 0,
            status: cat.status || 'active',
            parentId: null,
            updatedAt: new Date(),
          },
          create: {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            icon: cat.icon,
            displayOrder: cat.displayOrder,
            sortOrder: cat.sortOrder,
            level: cat.level || 0,
            status: cat.status || 'active',
            parentId: null,
            updatedAt: new Date(),
          },
        });
        console.log(`✅ 导入顶级分类: ${cat.name} (${cat.slug})`);
        importedTopLevel++;
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`⚠️  顶级分类已存在，跳过: ${cat.name} (${cat.slug})`);
          skipped++;
        } else {
          console.error(`❌ 导入顶级分类失败: ${cat.name} (${cat.slug})`, error.message);
        }
      }
    }

    // 导入子分类
    for (const cat of childCategories) {
      try {
        // 检查父分类是否存在
        const parentExists = await prisma.categories.findUnique({
          where: { id: cat.parentId },
        });

        if (!parentExists) {
          console.error(`❌ 父分类不存在，跳过子分类: ${cat.name} (${cat.slug}) - 父ID: ${cat.parentId}`);
          skipped++;
          continue;
        }

        await prisma.categories.upsert({
          where: { id: cat.id },
          update: {
            name: cat.name,
            slug: cat.slug,
            icon: cat.icon,
            displayOrder: cat.displayOrder,
            sortOrder: cat.sortOrder,
            level: cat.level || 1,
            status: cat.status || 'active',
            parentId: cat.parentId,
            updatedAt: new Date(),
          },
          create: {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            icon: cat.icon,
            displayOrder: cat.displayOrder,
            sortOrder: cat.sortOrder,
            level: cat.level || 1,
            status: cat.status || 'active',
            parentId: cat.parentId,
            updatedAt: new Date(),
          },
        });
        console.log(`✅ 导入子分类: ${cat.name} (${cat.slug}) - 父级: ${parentExists.name}`);
        importedChildren++;
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`⚠️  子分类已存在，跳过: ${cat.name} (${cat.slug})`);
          skipped++;
        } else {
          console.error(`❌ 导入子分类失败: ${cat.name} (${cat.slug})`, error.message);
        }
      }
    }

    console.log(`\n✅ 导入完成:`);
    console.log(`   导入顶级分类: ${importedTopLevel} 个`);
    console.log(`   导入子分类: ${importedChildren} 个`);
    console.log(`   跳过: ${skipped} 个`);
  } catch (error: any) {
    console.error('❌ 导入失败:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

