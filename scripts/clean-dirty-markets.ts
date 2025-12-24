/**
 * 🔥 清理不符合整点规律的"脏场次"
 * 
 * 用途：删除那些 startTime 不符合 00/15/30/45 分钟整点规律的、由用户误触发产生的场次
 * 执行：npx tsx scripts/clean-dirty-markets.ts
 */

import { prisma } from '../lib/prisma';
import dayjs from '../lib/dayjs';

async function cleanDirtyMarkets() {
  try {
    console.log('🧹 [Clean Dirty Markets] 开始清理不符合整点规律的场次...\n');
    
    // 查询所有工厂生成的市场
    const factoryMarkets = await prisma.market.findMany({
      where: {
        isFactory: true,
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        closingDate: true,
        period: true,
        templateId: true,
        status: true,
      },
    });
    
    console.log(`📊 [Clean Dirty Markets] 找到 ${factoryMarkets.length} 个工厂市场\n`);
    
    const dirtyMarkets: any[] = [];
    
    factoryMarkets.forEach((market) => {
      const period = Number(market.period) || 15;
      const endTime = dayjs.utc(market.closingDate);
      const startTime = endTime.subtract(period, 'minute');
      
      const minutes = startTime.utc().minute();
      const seconds = startTime.utc().second();
      const milliseconds = startTime.utc().millisecond();
      
      let isDirty = false;
      let reason = '';
      
      // 检查是否符合整点规律
      if (period === 15) {
        // 15分钟周期必须对齐到 00/15/30/45
        if (minutes % 15 !== 0 || seconds !== 0 || milliseconds !== 0) {
          isDirty = true;
          reason = `15分钟周期未对齐到 00/15/30/45 (当前: ${startTime.format('HH:mm:ss')})`;
        }
      } else if (period === 60) {
        // 1小时周期必须对齐到整点
        if (minutes !== 0 || seconds !== 0 || milliseconds !== 0) {
          isDirty = true;
          reason = `1小时周期未对齐到整点 (当前: ${startTime.format('HH:mm:ss')})`;
        }
      } else if (period === 240) {
        // 4小时周期必须对齐到 00/04/08/12/16/20
        const hours = startTime.utc().hour();
        if (hours % 4 !== 0 || minutes !== 0 || seconds !== 0 || milliseconds !== 0) {
          isDirty = true;
          reason = `4小时周期未对齐到 00/04/08/12/16/20 (当前: ${startTime.format('HH:mm:ss')})`;
        }
      } else if (period === 1440) {
        // 1天周期必须对齐到 00:00:00
        if (startTime.utc().hour() !== 0 || minutes !== 0 || seconds !== 0 || milliseconds !== 0) {
          isDirty = true;
          reason = `1天周期未对齐到 00:00:00 (当前: ${startTime.format('HH:mm:ss')})`;
        }
      }
      
      if (isDirty) {
        dirtyMarkets.push({
          ...market,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          reason,
        });
      }
    });
    
    console.log(`📋 [Clean Dirty Markets] 找到 ${dirtyMarkets.length} 个不符合整点规律的场次：\n`);
    
    if (dirtyMarkets.length > 0) {
      dirtyMarkets.forEach((market, idx) => {
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📋 脏场次 #${idx + 1}:`);
        console.log(`   ID: ${market.id}`);
        console.log(`   标题: ${market.title}`);
        console.log(`   开始时间: ${market.startTime}`);
        console.log(`   结束时间: ${market.endTime}`);
        console.log(`   周期: ${market.period} 分钟`);
        console.log(`   状态: ${market.status}`);
        console.log(`   问题: ${market.reason}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      });
      
      // 执行删除
      console.log('🗑️  [Clean Dirty Markets] 准备删除这些脏场次...\n');
      
      const deleteResult = await prisma.market.deleteMany({
        where: {
          id: {
            in: dirtyMarkets.map(m => m.id),
          },
        },
      });
      
      console.log(`✅ [Clean Dirty Markets] 成功删除 ${deleteResult.count} 个脏场次\n`);
      
      // 验证删除结果
      const remaining = await prisma.market.findMany({
        where: {
          id: {
            in: dirtyMarkets.map(m => m.id),
          },
        },
      });
      
      if (remaining.length === 0) {
        console.log('✅ [Clean Dirty Markets] 验证通过：所有脏场次已彻底清除\n');
      } else {
        console.log(`⚠️  [Clean Dirty Markets] 警告：仍有 ${remaining.length} 个记录未被删除\n`);
      }
    } else {
      console.log('✅ [Clean Dirty Markets] 未找到不符合整点规律的场次\n');
    }
    
  } catch (error) {
    console.error('❌ [Clean Dirty Markets] 执行失败:', error);
    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行脚本
cleanDirtyMarkets();
