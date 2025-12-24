/**
 * 🔥 48小时种子测试脚本
 * 
 * 用途：手动触发工厂预生成接口，验证数据正确性
 * 执行：npx tsx scripts/test-pregen-48h.ts
 * 
 * 验证规则：
 * - BTC 15m：数据库应物理生成且仅生成 192 条（48小时）记录，时间必须对齐 00/15/30/45
 * - ETH 1h：应物理生成 48 条记录，时间精准对齐整点
 * - 管理后台：此时"市场管理"的总数必须是 240 (192 + 48)，多一个都不行
 */

import { prisma } from '../lib/prisma';
import dayjs from '../lib/dayjs';

async function testPregen48h() {
  try {
    console.log('🧪 [Test PreGen 48h] 开始48小时种子测试...\n');
    
    // 1. 清空所有市场数据（如果之前有数据）
    const existingCount = await prisma.market.count();
    if (existingCount > 0) {
      console.log(`⚠️  [Test PreGen 48h] 检测到 ${existingCount} 条现有市场记录，请先运行 reset-all-markets.ts 清空数据\n`);
      return;
    }
    
    // 2. 手动触发预生成接口
    console.log('🚀 [Test PreGen 48h] 正在触发工厂预生成接口...\n');
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const secret = process.env.CRON_API_KEY || process.env.CRON_SECRET || '';
    
    const response = await fetch(`${apiUrl}/api/cron/factory-pregen?secret=${secret}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Test PreGen 48h] API 请求失败: ${response.status} ${response.statusText}`);
      console.error(`错误详情: ${errorText}\n`);
      return;
    }
    
    const result = await response.json();
    console.log('✅ [Test PreGen 48h] 预生成接口响应:', JSON.stringify(result, null, 2));
    console.log('\n');
    
    // 等待一下，确保数据库写入完成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. 验证 BTC 15m 模板
    console.log('📊 [Test PreGen 48h] 验证 BTC 15m 模板...\n');
    
    const btcTemplate = await prisma.marketTemplate.findFirst({
      where: {
        symbol: 'BTC/USD',
        period: 15,
        isActive: true,
      },
    });
    
    if (!btcTemplate) {
      console.error('❌ [Test PreGen 48h] 未找到 BTC 15m 模板\n');
      return;
    }
    
    const btcMarkets = await prisma.market.findMany({
      where: {
        templateId: btcTemplate.id,
        isFactory: true,
      },
      orderBy: {
        closingDate: 'asc',
      },
    });
    
    console.log(`📋 [Test PreGen 48h] BTC 15m 市场数量: ${btcMarkets.length} (期望: 192)\n`);
    
    if (btcMarkets.length !== 192) {
      console.error(`❌ [Test PreGen 48h] BTC 15m 市场数量不正确: 实际 ${btcMarkets.length}, 期望 192\n`);
    } else {
      console.log('✅ [Test PreGen 48h] BTC 15m 市场数量正确\n');
    }
    
    // 验证时间对齐（检查前10个和后10个）
    const checkAlignment = (markets: any[], periodMinutes: number) => {
      const errors: string[] = [];
      const checkCount = Math.min(10, markets.length);
      
      for (let i = 0; i < checkCount; i++) {
        const market = markets[i];
        const startTime = dayjs.utc(market.closingDate).subtract(periodMinutes, 'minute');
        const minutes = startTime.utc().minute();
        const seconds = startTime.utc().second();
        const ms = startTime.utc().millisecond();
        
        if (periodMinutes === 15) {
          if (minutes % 15 !== 0 || seconds !== 0 || ms !== 0) {
            errors.push(`市场 ${market.id}: startTime ${startTime.format('YYYY-MM-DD HH:mm:ss.SSS')} 未对齐到 00/15/30/45`);
          }
        } else if (periodMinutes === 60) {
          if (minutes !== 0 || seconds !== 0 || ms !== 0) {
            errors.push(`市场 ${market.id}: startTime ${startTime.format('YYYY-MM-DD HH:mm:ss.SSS')} 未对齐到整点`);
          }
        }
      }
      
      // 检查最后几个
      for (let i = Math.max(0, markets.length - checkCount); i < markets.length; i++) {
        const market = markets[i];
        const startTime = dayjs.utc(market.closingDate).subtract(periodMinutes, 'minute');
        const minutes = startTime.utc().minute();
        const seconds = startTime.utc().second();
        const ms = startTime.utc().millisecond();
        
        if (periodMinutes === 15) {
          if (minutes % 15 !== 0 || seconds !== 0 || ms !== 0) {
            errors.push(`市场 ${market.id}: startTime ${startTime.format('YYYY-MM-DD HH:mm:ss.SSS')} 未对齐到 00/15/30/45`);
          }
        } else if (periodMinutes === 60) {
          if (minutes !== 0 || seconds !== 0 || ms !== 0) {
            errors.push(`市场 ${market.id}: startTime ${startTime.format('YYYY-MM-DD HH:mm:ss.SSS')} 未对齐到整点`);
          }
        }
      }
      
      return errors;
    };
    
    const btcAlignmentErrors = checkAlignment(btcMarkets, 15);
    if (btcAlignmentErrors.length > 0) {
      console.error(`❌ [Test PreGen 48h] BTC 15m 时间对齐错误:\n${btcAlignmentErrors.join('\n')}\n`);
    } else {
      console.log('✅ [Test PreGen 48h] BTC 15m 时间对齐正确\n');
    }
    
    // 4. 验证 ETH 1h 模板
    console.log('📊 [Test PreGen 48h] 验证 ETH 1h 模板...\n');
    
    const ethTemplate = await prisma.marketTemplate.findFirst({
      where: {
        symbol: 'ETH/USD',
        period: 60,
        isActive: true,
      },
    });
    
    if (!ethTemplate) {
      console.log('⚠️  [Test PreGen 48h] 未找到 ETH 1h 模板（可能不存在，跳过验证）\n');
    } else {
      const ethMarkets = await prisma.market.findMany({
        where: {
          templateId: ethTemplate.id,
          isFactory: true,
        },
        orderBy: {
          closingDate: 'asc',
        },
      });
      
      console.log(`📋 [Test PreGen 48h] ETH 1h 市场数量: ${ethMarkets.length} (期望: 48)\n`);
      
      if (ethMarkets.length !== 48) {
        console.error(`❌ [Test PreGen 48h] ETH 1h 市场数量不正确: 实际 ${ethMarkets.length}, 期望 48\n`);
      } else {
        console.log('✅ [Test PreGen 48h] ETH 1h 市场数量正确\n');
      }
      
      const ethAlignmentErrors = checkAlignment(ethMarkets, 60);
      if (ethAlignmentErrors.length > 0) {
        console.error(`❌ [Test PreGen 48h] ETH 1h 时间对齐错误:\n${ethAlignmentErrors.join('\n')}\n`);
      } else {
        console.log('✅ [Test PreGen 48h] ETH 1h 时间对齐正确\n');
      }
    }
    
    // 5. 验证总数
    console.log('📊 [Test PreGen 48h] 验证总市场数量...\n');
    
    const totalMarkets = await prisma.market.count({
      where: {
        isFactory: true,
      },
    });
    
    const expectedTotal = ethTemplate ? 240 : 192; // 如果ETH模板不存在，只计算BTC
    
    console.log(`📋 [Test PreGen 48h] 总市场数量: ${totalMarkets} (期望: ${expectedTotal})\n`);
    
    if (totalMarkets !== expectedTotal) {
      console.error(`❌ [Test PreGen 48h] 总市场数量不正确: 实际 ${totalMarkets}, 期望 ${expectedTotal}\n`);
    } else {
      console.log('✅ [Test PreGen 48h] 总市场数量正确\n');
    }
    
    // 6. 输出测试总结
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 [Test PreGen 48h] 测试总结:');
    console.log(`   BTC 15m: ${btcMarkets.length}/192 ${btcMarkets.length === 192 ? '✅' : '❌'}`);
    if (ethTemplate) {
      const ethMarkets = await prisma.market.findMany({
        where: {
          templateId: ethTemplate.id,
          isFactory: true,
        },
      });
      console.log(`   ETH 1h: ${ethMarkets.length}/48 ${ethMarkets.length === 48 ? '✅' : '❌'}`);
    }
    console.log(`   总数量: ${totalMarkets}/${expectedTotal} ${totalMarkets === expectedTotal ? '✅' : '❌'}`);
    console.log(`   时间对齐: ${btcAlignmentErrors.length === 0 ? '✅' : '❌'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('❌ [Test PreGen 48h] 测试失败:', error);
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
testPregen48h();
