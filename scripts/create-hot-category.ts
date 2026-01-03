/**
 * 创建热门分类脚本
 * 如果热门分类不存在，则创建一个
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function createHotCategory() {
  try {
    // 检查是否已存在热门分类
    const existingHotCategory = await prisma.categories.findFirst({
      where: {
        OR: [
          { slug: 'hot' },
          { slug: '-1' },
          { name: { contains: '热门' } },
        ],
      },
    });

    if (existingHotCategory) {
      console.log('✅ 热门分类已存在:', {
        id: existingHotCategory.id,
        name: existingHotCategory.name,
        slug: existingHotCategory.slug,
      });
      return existingHotCategory;
    }

    // 创建热门分类
    const hotCategory = await prisma.categories.create({
      data: {
        id: randomUUID(),
        name: '热门',
        slug: 'hot',
        icon: 'Flame',
        displayOrder: 0,
        sortOrder: 0,
        level: 0,
        parentId: null,
        status: 'active',
        updatedAt: new Date(),
      },
    });

    console.log('✅ 热门分类创建成功:', {
      id: hotCategory.id,
      name: hotCategory.name,
      slug: hotCategory.slug,
    });

    return hotCategory;
  } catch (error) {
    console.error('❌ 创建热门分类失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createHotCategory()
  .then(() => {
    console.log('✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });
