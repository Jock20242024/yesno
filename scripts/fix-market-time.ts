// scripts/fix-market-time.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
  const marketId = '69f3c715-c249-40d7-8086-b8be0c66e589'; 
  
  console.log(`正在修正市场 ${marketId} 的时间...`);
  
  await prisma.market.update({
    where: { id: marketId },
    data: {
      // 修改为日志中找到的远程时间: 2025-12-24T04:30:00.000Z
      closingDate: new Date('2025-12-24T04:30:00.000Z')
    }
  });
  
  console.log('✅ 时间已修正为 04:30，请再次运行 debug-matcher.ts 查看是否匹配成功！');
  
  await prisma.$disconnect();
}

fix().catch(console.error);
