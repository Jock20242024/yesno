import { PrismaClient } from '@prisma/client';
import { createMarketFromTemplate, getNextPeriodTime } from '../lib/factory/engine';
import dayjs from '../lib/dayjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 开始测试"一键开张"功能（模拟点击 BTC-15m 的"立即生成"按钮）...\n');

  // 1. 查找 BTC-15m 模板
  const btc15m = await prisma.marketTemplate.findFirst({
    where: {
      symbol: { contains: 'BTC' },
      period: 15,
    },
  });

  if (!btc15m) {
    console.log('❌ 未找到 BTC-15m 模板');
    return;
  }

  console.log('✅ 找到 BTC-15m 模板:');
  console.log(`  ID: ${btc15m.id}`);
  console.log(`  名称: ${btc15m.name}`);
  console.log(`  周期: ${btc15m.period} 分钟`);
  console.log(`  标的: ${btc15m.symbol}\n`);

  // 2. 检查当前状态（应该没有工厂市场）
  const factoryMarketsBefore = await prisma.market.count({
    where: { isFactory: true },
  });
  console.log(`📊 生成前工厂市场数量: ${factoryMarketsBefore}\n`);

  // 3. 模拟"立即生成"逻辑（基于优化后的健康度判定）
  const now = dayjs.utc().toDate();
  console.log(`⏰ 当前时间: ${now.toISOString()}\n`);

  // 检查未来储备（优化后的逻辑）
  const futureMarkets = await prisma.market.findMany({
    where: {
      templateId: btc15m.id,
      isFactory: true,
      status: 'OPEN',
      reviewStatus: 'PUBLISHED',
      isActive: true,
    },
    select: {
      closingDate: true,
    },
  });

  // 计算未来场次数量
  let futureMarketCount = 0;
  for (const market of futureMarkets) {
    const { getStartTime } = await import('../lib/factory/engine');
    const startTime = getStartTime(market.closingDate, btc15m.period);
    if (startTime > now) {
      futureMarketCount++;
    }
  }

  const healthStatus = futureMarketCount >= 1 ? 'HEALTHY' : 'GAP';
  console.log(`📊 当前健康状态: ${healthStatus} (未来场次数量: ${futureMarketCount})\n`);

  // 4. 计算 overrideEndTime（如果是 GAP 状态，强制创建下一个未来周期）
  let overrideEndTime: Date | undefined = undefined;

  if (healthStatus === 'GAP') {
    // GAP 状态：计算下一个未来周期的结束时间
    // 先计算当前周期的结束时间
    const currentPeriodEndTime = getNextPeriodTime(btc15m.period, now);
    const { getStartTime } = await import('../lib/factory/engine');
    const currentPeriodStartTime = getStartTime(currentPeriodEndTime, btc15m.period);

    if (now >= currentPeriodStartTime) {
      // 当前时间在周期内，生成下一个周期的市场（确保是未来）
      overrideEndTime = getNextPeriodTime(btc15m.period, currentPeriodEndTime);
      console.log(`🚀 [GapFill] 强制为模板补充下一个未来场次: EndTime=${overrideEndTime.toISOString()}\n`);
    } else {
      // 当前时间在周期之前，使用当前周期的结束时间（已经是未来）
      overrideEndTime = currentPeriodEndTime;
      console.log(`🚀 [GapFill] 强制为模板补充当前未来场次: EndTime=${overrideEndTime.toISOString()}\n`);
    }
  } else {
    // 如果已经有未来场次，使用默认逻辑（生成下一个周期的市场）
    overrideEndTime = getNextPeriodTime(btc15m.period);
    console.log(`📅 使用默认逻辑生成下一个周期: EndTime=${overrideEndTime.toISOString()}\n`);
  }

  // 5. 调用 createMarketFromTemplate 生成市场
  console.log('🔄 正在生成市场...\n');
  let marketId: string;
  try {
    marketId = await createMarketFromTemplate(btc15m as any, overrideEndTime);
    console.log(`✅ 市场生成成功！`);
    console.log(`  市场 ID: ${marketId}\n`);
  } catch (error: any) {
    console.error('❌ 市场生成失败:', error.message);
    console.error('   错误堆栈:', error.stack);
    return;
  }

  // 6. 验证生成结果
  const factoryMarketsAfter = await prisma.market.count({
    where: { isFactory: true },
  });

  const newMarket = await prisma.market.findFirst({
    where: { id: marketId },
    select: {
      id: true,
      title: true,
      closingDate: true,
      status: true,
      isFactory: true,
    },
  });

  console.log(`📊 生成后工厂市场数量: ${factoryMarketsAfter}`);
  console.log(`📊 新增市场数量: ${factoryMarketsAfter - factoryMarketsBefore}\n`);

  if (newMarket) {
    console.log('✅ 新生成的市场详情:');
    console.log(`  ID: ${newMarket.id}`);
    console.log(`  标题: ${newMarket.title}`);
    console.log(`  结束时间: ${newMarket.closingDate.toISOString()}`);
    console.log(`  状态: ${newMarket.status}`);
    console.log(`  是否工厂市场: ${newMarket.isFactory}\n`);
  }

  // 7. 再次检查健康状态
  const futureMarketsAfter = await prisma.market.findMany({
    where: {
      templateId: btc15m.id,
      isFactory: true,
      status: 'OPEN',
      reviewStatus: 'PUBLISHED',
      isActive: true,
    },
    select: {
      closingDate: true,
    },
  });

  let futureMarketCountAfter = 0;
  for (const market of futureMarketsAfter) {
    const { getStartTime } = await import('../lib/factory/engine');
    const startTime = getStartTime(market.closingDate, btc15m.period);
    if (startTime > now) {
      futureMarketCountAfter++;
    }
  }

  const healthStatusAfter = futureMarketCountAfter >= 1 ? 'HEALTHY' : 'GAP';
  console.log(`📊 生成后健康状态: ${healthStatusAfter} (未来场次数量: ${futureMarketCountAfter})\n`);

  if (healthStatusAfter === 'HEALTHY') {
    console.log('✅ 测试成功！模板已从 GAP 状态恢复为 HEALTHY 状态。');
  } else {
    console.log('⚠️  警告：生成后仍然处于 GAP 状态，可能需要检查生成逻辑。');
  }
}

main()
  .catch((e) => {
    console.error('❌ 错误：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
