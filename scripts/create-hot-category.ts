import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 检查并创建/修复"热门"分类...\n');

  // 1. 检查是否已存在热门分类
  const existingHot = await prisma.category.findFirst({
    where: {
      OR: [
        { slug: "-1" },
        { slug: "hot" },
        { name: { contains: "热门" } }
      ]
    },
  });

  if (existingHot) {
    console.log('✅ "热门"分类已存在:');
    console.log(`   ID: ${existingHot.id}`);
    console.log(`   Name: ${existingHot.name}`);
    console.log(`   Slug: ${existingHot.slug}`);
    
    // 确保 slug 是 "-1"
    if (existingHot.slug !== "-1") {
      console.log('\n🔄 更新 slug 为 "-1"...');
      const updated = await prisma.category.update({
        where: { id: existingHot.id },
        data: { slug: "-1" },
      });
      console.log('✅ 更新完成，新 slug:', updated.slug);
    }
    
    console.log('\n📋 总结：');
    console.log(`   "热门"分类的真实 ID 是: ${existingHot.id}`);
    console.log(`   "热门"分类的 slug 是: ${existingHot.slug}`);
    console.log(`   前端表单应发送 ID: ${existingHot.id}（不是 "-1"）`);
  } else {
    console.log('❌ 未找到"热门"分类，开始创建...');
    
    // 创建热门分类（使用 UUID 作为 ID，slug 为 "-1"）
    const newHotCategory = await prisma.category.create({
      data: {
        name: "热门",
        slug: "-1",
        icon: "Flame",
        displayOrder: 0,
        sortOrder: 0,
        level: 0,
        status: "active",
        parentId: null,
      },
    });
    
    console.log('✅ "热门"分类创建成功:');
    console.log(JSON.stringify(newHotCategory, null, 2));
    console.log('\n📋 前端表单应发送的 ID:', newHotCategory.id);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
