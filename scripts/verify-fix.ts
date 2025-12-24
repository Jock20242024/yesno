import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  const market = await prisma.market.findUnique({
    where: { id: '69f3c715-c249-40d7-8086-b8be0c66e589' },
    select: { id: true, title: true, closingDate: true },
  });
  
  if (market) {
    console.log('\n✅ 市场时间已更新：');
    console.log(`   市场ID: ${market.id}`);
    console.log(`   标题: ${market.title}`);
    console.log(`   结束时间: ${market.closingDate.toISOString()}`);
    console.log(`   目标时间: 2025-12-24T04:30:00.000Z`);
    console.log(`   匹配: ${market.closingDate.toISOString() === '2025-12-24T04:30:00.000Z' ? '✅ 是' : '❌ 否'}\n`);
  } else {
    console.log('❌ 未找到市场');
  }
  
  await prisma.$disconnect();
}

verify().catch(console.error);
