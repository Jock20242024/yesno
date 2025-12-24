/**
 * 临时脚本：清理 ETH 15m 的旧模版记录
 * 目的：删除所有 symbol 为 'ETH' 且 period 为 15 的旧模版记录
 */

import { prisma } from '../lib/prisma';

async function cleanupEthTemplates() {
  try {
    console.log('🧹 开始清理 ETH 15m 的旧模版记录...');
    
    // 删除所有 symbol 包含 'ETH' 且 period 为 15 的模版
    const result = await prisma.marketTemplate.deleteMany({
      where: {
        symbol: {
          contains: 'ETH',
        },
        period: 15,
      },
    });
    
    console.log(`✅ 已删除 ${result.count} 个 ETH 15m 模版记录`);
    
    // 也可以更精确地删除 symbol 完全等于 'ETH/USD' 的
    const result2 = await prisma.marketTemplate.deleteMany({
      where: {
        symbol: 'ETH/USD',
        period: 15,
      },
    });
    
    console.log(`✅ 已删除 ${result2.count} 个 ETH/USD 15m 模版记录`);
    
    console.log('✅ 清理完成！');
  } catch (error) {
    console.error('❌ 清理失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupEthTemplates();