/**
 * 初始化数据采集源
 * 运行方式: npx tsx scripts/init-data-sources.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始初始化数据采集源...');

  // 创建 Polymarket 采集源
  const polymarketSource = await prisma.data_sources.upsert({
    where: { sourceName: 'Polymarket' },
    update: {
      status: 'ACTIVE',
      multiplier: 1.0,
    },
    create: {
      sourceName: 'Polymarket',
      status: 'ACTIVE',
      multiplier: 1.0,
      itemsCount: 0,
      config: JSON.stringify({
        apiUrl: 'https://gamma-api.polymarket.com/markets',
        defaultLimit: 100,
      }),
    },
  });

  console.log(`✅ Polymarket 采集源已创建/更新: ${polymarketSource.id}`);
  console.log('');
  console.log('🎉 数据采集源初始化完成！');
}

main()
  .catch((e) => {
    console.error('❌ 脚本执行失败:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
