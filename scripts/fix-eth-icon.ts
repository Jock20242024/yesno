/**
 * 🔥 修复 ETH 模板图标错误
 * 
 * 问题：数据库中 ETH 相关的市场显示的是 BTC 的 Logo
 * 修复：将所有 Symbol 包含 "ETH" 的市场的 image/iconUrl 字段更新为正确的 ETH 图标
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// 加载环境变量
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

// 🔥 ETH 图标 URL（使用项目中常用的图标 URL）
const ETH_ICON_URL = 'https://cryptologos.cc/logos/ethereum-eth-logo.png';

// 🔥 BTC 图标 URL（用于对比检查）
const BTC_ICON_URL = 'https://cryptologos.cc/logos/bitcoin-btc-logo.png';

async function fixEthIcons() {
  try {
    console.log('🔍 [Fix ETH Icon] 开始检查 ETH 相关市场的图标...\n');

    // 1. 查找所有 Symbol 包含 "ETH" 或 "Ethereum" 的市场
    const ethMarkets = await prisma.market.findMany({
      where: {
        OR: [
          { symbol: { contains: 'ETH', mode: 'insensitive' } },
          { symbol: { contains: 'Ethereum', mode: 'insensitive' } },
          { title: { contains: 'ETH', mode: 'insensitive' } },
          { title: { contains: '以太坊', mode: 'insensitive' } },
        ],
        isFactory: true, // 只修复工厂市场
      },
      select: {
        id: true,
        title: true,
        symbol: true,
        image: true,
        iconUrl: true,
      },
    });

    console.log(`📊 [Fix ETH Icon] 找到 ${ethMarkets.length} 个 ETH 相关市场\n`);

    if (ethMarkets.length === 0) {
      console.log('✅ [Fix ETH Icon] 没有找到需要修复的市场');
      return;
    }

    // 2. 检查哪些市场使用了错误的 BTC 图标
    const marketsToFix = ethMarkets.filter((market) => {
      const currentImage = market.image || market.iconUrl || '';
      // 检查是否包含 BTC 相关的 URL 或路径
      return (
        currentImage.includes('bitcoin') ||
        currentImage.includes('BTC') ||
        currentImage.includes('btc') ||
        currentImage === BTC_ICON_URL ||
        (currentImage && !currentImage.includes('ethereum') && !currentImage.includes('ETH') && !currentImage.includes('eth'))
      );
    });

    console.log(`🔧 [Fix ETH Icon] 需要修复的市场数量: ${marketsToFix.length}\n`);

    if (marketsToFix.length === 0) {
      console.log('✅ [Fix ETH Icon] 所有 ETH 市场的图标都是正确的');
      return;
    }

    // 3. 显示需要修复的市场详情
    console.log('📋 [Fix ETH Icon] 需要修复的市场列表:');
    marketsToFix.forEach((market, index) => {
      console.log(`  ${index + 1}. ${market.title}`);
      console.log(`     Symbol: ${market.symbol}`);
      console.log(`     当前 image: ${market.image || 'null'}`);
      console.log(`     当前 iconUrl: ${market.iconUrl || 'null'}`);
      console.log('');
    });

    // 4. 批量更新图标 URL
    let updatedCount = 0;
    for (const market of marketsToFix) {
      try {
        await prisma.market.update({
          where: { id: market.id },
          data: {
            image: ETH_ICON_URL,
            iconUrl: ETH_ICON_URL, // 同时更新两个字段，确保兼容性
          },
        });
        updatedCount++;
        console.log(`✅ [Fix ETH Icon] 已更新: ${market.title}`);
      } catch (error: any) {
        console.error(`❌ [Fix ETH Icon] 更新失败 (${market.id}): ${error.message}`);
      }
    }

    console.log(`\n🎯 [Fix ETH Icon] 修复完成！共更新了 ${updatedCount} 个市场的图标`);

    // 5. 验证修复结果
    console.log('\n🔍 [Fix ETH Icon] 验证修复结果...');
    const verifyMarkets = await prisma.market.findMany({
      where: {
        id: { in: marketsToFix.map((m) => m.id) },
      },
      select: {
        id: true,
        title: true,
        image: true,
        iconUrl: true,
      },
    });

    const correctlyFixed = verifyMarkets.filter(
      (m) => (m.image || m.iconUrl) === ETH_ICON_URL
    ).length;

    console.log(`✅ [Fix ETH Icon] 验证通过: ${correctlyFixed}/${marketsToFix.length} 个市场图标已正确设置`);

  } catch (error: any) {
    console.error(`❌ [Fix ETH Icon] 执行失败: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行修复
fixEthIcons()
  .then(() => {
    console.log('\n✅ [Fix ETH Icon] 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ [Fix ETH Icon] 脚本执行失败:', error);
    process.exit(1);
  });