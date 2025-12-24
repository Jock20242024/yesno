/**
 * 市场工厂服务（已废弃，请使用 lib/factory/engine.ts）
 * 自动化创建市场的核心逻辑
 * 
 * @deprecated 请使用 lib/factory/engine.ts 中的新实现
 */

import prisma from '@/lib/prisma';
import { getPrice } from '@/lib/oracle';
import { MarketStatus } from '@/types/data';

// 🔥 重新导出新引擎的函数，保持向后兼容
export { 
  shouldCreateMarket, 
  createMarketFromTemplate, 
  checkAndCreateMarkets 
} from './factory/engine';

interface MarketTemplate {
  id: string;
  name: string;
  symbol: string;
  period: number; // 分钟数
  advanceTime: number; // 秒数
  oracleUrl?: string | null;
  isActive: boolean;
  lastMarketId?: string | null;
  lastCreatedAt?: Date | null;
}

/**
 * 计算下一个15分钟周期的时间点
 * 例如：如果现在是 14:23，下一个周期应该是 14:30
 */
function getNextPeriodTime(periodMinutes: number): Date {
  const now = new Date();
  const minutes = now.getMinutes();
  const nextPeriodMinutes = Math.ceil(minutes / periodMinutes) * periodMinutes;
  
  const nextTime = new Date(now);
  nextTime.setMinutes(nextPeriodMinutes);
  nextTime.setSeconds(0);
  nextTime.setMilliseconds(0);

  // 如果下一个周期已经过了，则跳到下一个小时
  if (nextTime <= now) {
    nextTime.setHours(nextTime.getHours() + 1);
    nextTime.setMinutes(0);
  }

  return nextTime;
}

// 🔥 注意：shouldCreateMarket 已从 ./factory/engine 重新导出，不再在此定义

/**
 * 为模板创建新的市场（已废弃，使用 engine.ts 中的新实现）
 * @deprecated 请使用 lib/factory/engine.ts 中的 createMarketFromTemplate
 */
async function createMarketFromTemplateOld(template: MarketTemplate): Promise<string> {
  try {
    console.log(`🏗️ [MarketFactory] 开始为模板 ${template.name} 创建市场...`);

    // 1. 获取实时价格（行权价）
    const priceResult = await getPrice(template.symbol);
    const strikePrice = priceResult.price;
    
    console.log(`💰 [MarketFactory] 获取到 ${template.symbol} 价格: $${strikePrice}`);

    // 2. 计算结束时间（下一个周期的时间点）
    const endTime = getNextPeriodTime(template.period);
    
    // 3. 生成市场标题
    const periodLabel = template.period === 15 ? '15分钟' : `${template.period}分钟`;
    const title = `${template.symbol} ${periodLabel}盘 - ${endTime.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;

    // 4. 创建市场数据
    const marketData = {
      title,
      description: `${template.symbol} ${periodLabel}周期预测市场，行权价: $${strikePrice.toFixed(2)}`,
      category: '加密货币', // 默认分类
      endTime: endTime.toISOString(),
      sourceUrl: template.oracleUrl || undefined,
      feeRate: 0.05, // 默认费率 5%
      // 行权价可以存储在 description 或其他字段中
      // 如果 Market 模型有 strikePrice 字段，可以在这里添加
    };

    // 5. 使用 DBService 创建市场（已废弃的旧实现）
    // 注意：此函数已废弃，请使用 lib/factory/engine.ts 中的新实现
    const { DBService } = await import('./dbService');
    const newMarket = await DBService.addMarket(
      {
        id: `M-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
        title: marketData.title,
        description: marketData.description,
        closingDate: marketData.endTime,
        status: MarketStatus.OPEN,
        totalVolume: 0,
        totalYes: 0,
        totalNo: 0,
        feeRate: marketData.feeRate,
        category: marketData.category,
        categorySlug: 'crypto',
        createdAt: new Date().toISOString(),
      },
      {
        category: marketData.category,
        categorySlug: 'crypto',
      }
    );

    console.log(`✅ [MarketFactory] 市场创建成功: ${newMarket.id}`);

    // 6. 更新模板的最后创建时间
    await prisma.marketTemplate.update({
      where: { id: template.id },
      data: {
        lastMarketId: newMarket.id,
        lastCreatedAt: new Date(),
      },
    });

    return newMarket.id;
  } catch (error) {
    console.error(`❌ [MarketFactory] 创建市场失败:`, error);
    throw error;
  }
}

/**
 * 检查所有激活的模板并创建市场（已废弃，使用 engine.ts 中的新实现）
 * @deprecated 请使用 lib/factory/engine.ts 中的 checkAndCreateMarkets
 */
async function checkAndCreateMarketsOld(): Promise<void> {
  try {
    console.log('🔄 [MarketFactory] 开始检查模板...');

    // 获取所有激活的模板
    const templates = await prisma.marketTemplate.findMany({
      where: {
        isActive: true,
      },
    });

    console.log(`📋 [MarketFactory] 找到 ${templates.length} 个激活的模板`);

    for (const template of templates) {
      try {
        // 🔥 使用重新导出的 shouldCreateMarket
        const { shouldCreateMarket } = await import('./factory/engine');
        const shouldCreate = await shouldCreateMarket(template as any);
        
        if (shouldCreate) {
          // 检查是否已经创建过（避免重复创建）
          // 如果上次创建时间距离现在小于周期的一半，则跳过
          if (template.lastCreatedAt) {
            const timeSinceLastCreate = Date.now() - template.lastCreatedAt.getTime();
            const halfPeriod = (template.period * 60 * 1000) / 2;
            
            if (timeSinceLastCreate < halfPeriod) {
              console.log(`⏭️ [MarketFactory] 模板 ${template.name} 最近已创建，跳过`);
              continue;
            }
          }

          await createMarketFromTemplate(template);
          console.log(`✅ [MarketFactory] 模板 ${template.name} 市场创建完成`);
        }
      } catch (error) {
        console.error(`❌ [MarketFactory] 处理模板 ${template.name} 失败:`, error);
        // 继续处理其他模板，不中断整个流程
      }
    }
  } catch (error) {
    console.error('❌ [MarketFactory] 检查模板失败:', error);
    throw error;
  }
}
