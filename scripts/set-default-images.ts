/**
 * 为缺少 image 的市场设置默认封面
 * 根据分类设置不同的默认图片
 * 
 * 运行方式: npx tsx scripts/set-default-images.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 默认图片映射（根据分类）
const DEFAULT_IMAGES: Record<string, string> = {
  politics: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/politics-default.jpg',
  technology: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/technology-default.jpg',
  sports: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/sports-default.jpg',
  finance: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/finance-default.jpg',
  crypto: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/crypto-default.jpg',
  default: 'https://polymarket-upload.s3.us-east-2.amazonaws.com/default-market.jpg',
};

// 或者使用本地默认图片路径
const LOCAL_DEFAULT_IMAGES: Record<string, string> = {
  politics: '/images/default-politics.png',
  technology: '/images/default-technology.png',
  sports: '/images/default-sports.png',
  finance: '/images/default-finance.png',
  crypto: '/images/default-crypto.png',
  default: '/images/default-market.png',
};

async function main() {
  console.log('🚀 ========== 为缺少 image 的市场设置默认封面 ==========');
  console.log(`⏰ 开始时间: ${new Date().toISOString()}\n`);

  try {
    // 查找所有缺少 image 的 POLYMARKET 市场
    const markets = await prisma.market.findMany({
      where: {
        source: 'POLYMARKET',
        isActive: true,
        OR: [
          { image: null },
          { image: '' },
        ],
      },
      select: {
        id: true,
        title: true,
        externalId: true,
        category: true,
        categorySlug: true,
        image: true,
      },
    });

    console.log(`📊 找到 ${markets.length} 个缺少 image 的市场\n`);

    if (markets.length === 0) {
      console.log('✅ 所有市场都有 image 数据！');
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const market of markets) {
      try {
        // 确定分类
        const category = market.categorySlug || market.category || 'default';
        const categoryKey = category.toLowerCase();
        
        // 选择默认图片（优先使用本地路径，如果没有则使用外部 URL）
        // 注意：这里我们使用一个通用的默认图片，因为实际项目中可能没有这些图片文件
        // 可以根据实际情况调整
        let defaultImage: string;
        
        // 对于政治类市场，使用一个统一的默认封面
        if (categoryKey.includes('politic') || categoryKey.includes('election')) {
          // 可以使用一个通用的政治类图片 URL，或者使用本地路径
          defaultImage = 'https://polymarket-upload.s3.us-east-2.amazonaws.com/politics-default.jpg';
        } else if (categoryKey.includes('tech')) {
          defaultImage = 'https://polymarket-upload.s3.us-east-2.amazonaws.com/technology-default.jpg';
        } else if (categoryKey.includes('sport')) {
          defaultImage = 'https://polymarket-upload.s3.us-east-2.amazonaws.com/sports-default.jpg';
        } else if (categoryKey.includes('finance') || categoryKey.includes('economy')) {
          defaultImage = 'https://polymarket-upload.s3.us-east-2.amazonaws.com/finance-default.jpg';
        } else if (categoryKey.includes('crypto')) {
          defaultImage = 'https://polymarket-upload.s3.us-east-2.amazonaws.com/crypto-default.jpg';
        } else {
          // 默认使用一个通用的市场图片
          defaultImage = 'https://polymarket-upload.s3.us-east-2.amazonaws.com/default-market.jpg';
        }

        // 更新数据库
        await prisma.market.update({
          where: { id: market.id },
          data: {
            image: defaultImage,
            updatedAt: new Date(),
          },
        });

        console.log(`✅ 已设置默认图片: ${market.title}`);
        console.log(`   分类: ${category}`);
        console.log(`   默认图片: ${defaultImage}`);
        updatedCount++;

      } catch (error) {
        console.error(`❌ 更新失败 (ID: ${market.id}):`, error);
        skippedCount++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 更新结果统计:');
    console.log(`   ✅ 成功更新: ${updatedCount}`);
    console.log(`   ❌ 更新失败: ${skippedCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 验证更新结果
    console.log('🔍 验证更新结果...\n');
    const updatedMarkets = await prisma.market.findMany({
      where: {
        id: { in: markets.map(m => m.id) },
      },
      select: {
        id: true,
        title: true,
        category: true,
        image: true,
      },
      take: 10,
    });

    updatedMarkets.forEach(market => {
      console.log(`市场: ${market.title}`);
      console.log(`  分类: ${market.category || 'N/A'}`);
      console.log(`  Image: ${market.image || '❌ NULL'}`);
      console.log('');
    });

    console.log(`⏰ 结束时间: ${new Date().toISOString()}`);
    console.log('✅ ========== 设置默认封面完成 ==========\n');

  } catch (error) {
    console.error('❌ 脚本执行失败:', error);
    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
