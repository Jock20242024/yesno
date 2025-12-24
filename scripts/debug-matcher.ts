/**
 * 🔍 匹配逻辑诊断脚本 (Read-Only Diagnosis)
 * 
 * 目的：诊断为什么工厂市场无法自动匹配 Polymarket ID
 * 只做只读诊断，不做任何修改
 * 
 * 使用方法：
 * npx tsx scripts/debug-matcher.ts
 */

// 🔥 加载环境变量（确保 .env 文件被加载）
import { config } from 'dotenv';
import { resolve } from 'path';

// 加载 .env 文件（从项目根目录）
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') }); // 也加载 .env.local（如果存在）

import { PrismaClient, MarketStatus } from '@prisma/client';
const prisma = new PrismaClient();

async function diagnoseMatcher() {
  try {
    console.log('🚀 诊断脚本启动...\n');
    console.log('🔍 ===========================================');
    console.log('🔍 工厂市场匹配逻辑诊断（只读）');
    console.log('🔍 ===========================================\n');

    // 步骤1：取样 - 从数据库读取一个 isFactory=true 且 externalId=null 的市场
    console.log('📋 步骤1：从数据库取样工厂市场（isFactory=true, externalId=null）...\n');
    
    let sampleMarket = await prisma.market.findFirst({
      where: {
        npm run devisFactory: true,
        isActive: true,
        status: MarketStatus.OPEN,
        externalId: null,
        templateId: { not: null },
        period: { not: null },
        // 🔥 closingDate 是 DateTime 类型（非可空），不需要 not: null 检查
      },
      include: {
        marketTemplate: {
          select: {
            id: true,
            name: true,
            symbol: true,
            period: true,
          },
        },
      },
      orderBy: {
        closingDate: 'asc', // 取最早的一个
      },
    });

    // 🔥 模拟数据兜底：如果数据库为空，使用模拟数据
    let isMockMode = false;
    if (!sampleMarket) {
      console.log('⚠️ 数据库为空，切换到模拟模式 (Mock Mode)\n');
      isMockMode = true;
      
      // 创建模拟市场对象（未来15分钟）
      const mockEndTime = new Date();
      mockEndTime.setMinutes(mockEndTime.getMinutes() + 15); // 未来15分钟
      
      sampleMarket = {
        id: 'mock-market-id',
        title: 'BTC涨跌-15分钟（模拟）',
        status: MarketStatus.OPEN,
        closingDate: mockEndTime,
        marketTemplate: {
          id: 'mock-template-id',
          name: 'BTC涨跌',
          symbol: 'BTC/USD',
          period: 15,
        },
        period: 15,
      } as any;
      
      console.log('📋 使用模拟数据：');
      console.log(`   市场ID: ${sampleMarket.id} (模拟)`);
      console.log(`   标题: ${sampleMarket.title}`);
      console.log(`   状态: ${sampleMarket.status}`);
      console.log(`   周期: ${(sampleMarket as any).period} 分钟`);
      console.log(`   结束时间 (closingDate): ${sampleMarket.closingDate.toISOString()}`);
      console.log(`   模板符号 (symbol): ${sampleMarket.marketTemplate.symbol}`);
      console.log(`   模板名称: ${sampleMarket.marketTemplate.name}\n`);
    } else {
      console.log('✅ 找到样本市场：');
      console.log(`   市场ID: ${sampleMarket.id}`);
      console.log(`   标题: ${sampleMarket.title}`);
      console.log(`   状态: ${sampleMarket.status}`);
      console.log(`   周期: ${(sampleMarket as any).period} 分钟`);
      console.log(`   结束时间 (closingDate): ${sampleMarket.closingDate.toISOString()}`);
      
      if (sampleMarket.marketTemplate) {
        console.log(`   模板符号 (symbol): ${sampleMarket.marketTemplate.symbol}`);
        console.log(`   模板名称: ${sampleMarket.marketTemplate.name}`);
      } else {
        console.log('   ⚠️ 警告：没有关联的模板');
        await prisma.$disconnect();
        return;
      }
    }

    // 步骤2：打印本地特征
    console.log('\n📋 步骤2：本地市场特征\n');
    const localEndTime = sampleMarket.closingDate;
    const symbol = sampleMarket.marketTemplate.symbol;
    const period = (sampleMarket as any).period || sampleMarket.marketTemplate.period;
    
    if (isMockMode) {
      console.log('   ⚠️ 当前使用模拟数据模式\n');
    }
    
    console.log(`   标的符号 (symbol): ${symbol}`);
    console.log(`   周期 (period): ${period} 分钟`);
    console.log(`   结束时间 (endTime/closingDate): ${localEndTime.toISOString()}`);
    console.log(`   结束时间 (Unix时间戳): ${localEndTime.getTime()}`);

    // 步骤3：宽范围搜索 - 调用 Polymarket API
    console.log('\n📋 步骤3：调用 Polymarket API 搜索匹配市场...\n');
    
    // 计算搜索时间窗口（本地 endTime 前后 1 小时）
    const searchWindowStart = new Date(localEndTime.getTime() - 60 * 60 * 1000); // 前1小时
    const searchWindowEnd = new Date(localEndTime.getTime() + 60 * 60 * 1000); // 后1小时
    
    console.log(`   搜索时间窗口: ${searchWindowStart.toISOString()} ~ ${searchWindowEnd.toISOString()}`);
    console.log(`   本地结束时间: ${localEndTime.toISOString()}`);
    
    // 提取标的符号（如 "BTC/USD" -> "BTC", "ETH/USD" -> "ETH"）
    const assetSymbol = symbol.split('/')[0].toUpperCase();
    console.log(`   搜索标的符号: ${assetSymbol}\n`);

    // 查询 Polymarket API（使用分页查询，获取更多市场，特别是开放的市场）
    console.log(`   查询策略：先查询开放市场，再查询所有市场\n`);
    
    let apiMarkets: any[] = [];
    const limit = 1000;
    const maxPages = 3; // 最多查询3页
    
    // 策略1：先查询开放市场（包含当前活跃的市场）
    for (let page = 0; page < maxPages; page++) {
      const offset = page * limit;
      const apiUrl = `https://gamma-api.polymarket.com/markets?closed=false&limit=${limit}&offset=${offset}&order=volume&ascending=false`;
      
      try {
        console.log(`   查询开放市场（页 ${page + 1}/${maxPages}）: offset=${offset}`);
        const response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (!response.ok) {
          console.warn(`   ⚠️ API请求失败（页 ${page + 1}）: ${response.status}`);
          break;
        }

        const pageMarkets = await response.json();
        if (!pageMarkets || !Array.isArray(pageMarkets) || pageMarkets.length === 0) {
          break; // 没有更多数据了
        }
        
        apiMarkets.push(...pageMarkets);
        console.log(`   ✅ 获取 ${pageMarkets.length} 个开放市场（累计 ${apiMarkets.length} 个）`);
        
        // 如果返回的数据少于limit，说明已经是最后一页了
        if (pageMarkets.length < limit) {
          break;
        }
      } catch (error: any) {
        console.warn(`   ⚠️ 查询开放市场失败（页 ${page + 1}）: ${error.message}`);
        break;
      }
    }
    
    // 策略2：如果开放市场数量不足，再查询所有市场（包括已关闭的）
    if (apiMarkets.length < limit) {
      console.log(`\n   补充查询：查询所有市场（包括已关闭的）...`);
      try {
        const allMarketsUrl = `https://gamma-api.polymarket.com/markets?limit=${limit}&offset=0&order=volume&ascending=false`;
        const response = await fetch(allMarketsUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (response.ok) {
          const allMarketsData = await response.json();
          if (allMarketsData && Array.isArray(allMarketsData) && allMarketsData.length > 0) {
            // 合并数据，去重（基于market.id）
            const existingIds = new Set(apiMarkets.map(m => m.id));
            const newMarkets = allMarketsData.filter((m: any) => m.id && !existingIds.has(m.id));
            apiMarkets.push(...newMarkets);
            console.log(`   ✅ 从所有市场获取 ${newMarkets.length} 个新市场（累计 ${apiMarkets.length} 个）`);
          }
        }
      } catch (error: any) {
        console.warn(`   ⚠️ 查询所有市场失败: ${error.message}`);
      }
    }
    
    console.log(`\n   ✅ 总计获取 ${apiMarkets.length} 个市场\n`);

    // 步骤4：打印远程候选人 - 筛选包含标的符号的市场
    console.log('📋 步骤4：筛选包含标的符号的市场...\n');
    
    const candidateMarkets = apiMarkets.filter((m: any) => {
      const question = (m.question || '').toUpperCase();
      const slug = (m.slug || '').toUpperCase();
      return question.includes(assetSymbol) || slug.includes(assetSymbol);
    });

    console.log(`   找到 ${candidateMarkets.length} 个包含 "${assetSymbol}" 的市场\n`);

    // 步骤5：高亮差异 - 计算时间差异
    console.log('📋 步骤5：分析时间差异...\n');
    
    if (candidateMarkets.length === 0) {
      console.log('   ❌ 没有找到包含标的符号的市场');
      console.log('   💡 可能原因：');
      console.log('      1. Polymarket API 中没有对应的市场');
      console.log('      2. 标的符号不匹配');
      console.log('      3. API返回的数据量不足（limit=1000可能不够）');
    } else {
      console.log(`   前 ${Math.min(20, candidateMarkets.length)} 个候选市场的时间分析：\n`);
      
      candidateMarkets.slice(0, 20).forEach((m: any, index: number) => {
        // 尝试从不同位置获取结束时间
        let marketEndTime: Date | null = null;
        
        if (m.endDate) {
          marketEndTime = new Date(m.endDate);
        } else if (m.endDateISO) {
          marketEndTime = new Date(m.endDateISO);
        } else if (m.resolutionTime) {
          marketEndTime = new Date(m.resolutionTime);
        } else if (m.events && Array.isArray(m.events) && m.events.length > 0) {
          const firstEvent = m.events[0];
          if (firstEvent.endDate) {
            marketEndTime = new Date(firstEvent.endDate);
          } else if (firstEvent.endDateISO) {
            marketEndTime = new Date(firstEvent.endDateISO);
          } else if (firstEvent.resolutionTime) {
            marketEndTime = new Date(firstEvent.resolutionTime);
          }
        }

        const question = m.question || m.slug || 'N/A';
        const conditionId = m.id || m.conditionId || 'N/A';
        
        console.log(`   [${index + 1}] ${question.substring(0, 60)}...`);
        console.log(`       Condition ID: ${conditionId}`);
        
        if (marketEndTime) {
          const timeDiffSeconds = (marketEndTime.getTime() - localEndTime.getTime()) / 1000;
          const timeDiffMinutes = timeDiffSeconds / 60;
          const timeDiffAbs = Math.abs(timeDiffSeconds);
          
          console.log(`       远程结束时间: ${marketEndTime.toISOString()}`);
          console.log(`       时间差: ${timeDiffSeconds.toFixed(2)} 秒 (${timeDiffMinutes > 0 ? '+' : ''}${timeDiffMinutes.toFixed(2)} 分钟)`);
          
          // 判断是否在匹配窗口内（±15分钟 = ±900秒）
          const matchWindow = 15 * 60; // 15分钟
          if (timeDiffAbs <= matchWindow) {
            console.log(`       ✅ 在匹配窗口内（±${matchWindow/60}分钟）`);
          } else {
            console.log(`       ❌ 超出匹配窗口（±${matchWindow/60}分钟）`);
          }
        } else {
          console.log(`       ⚠️ 未找到结束时间字段`);
        }
        console.log('');
      });
    }

    // 步骤6：总结
    console.log('\n📋 步骤6：诊断总结\n');
    console.log('本地市场信息：');
    console.log(`  标题: ${sampleMarket.title}`);
    console.log(`  符号: ${symbol}`);
    console.log(`  周期: ${period} 分钟`);
    console.log(`  结束时间: ${localEndTime.toISOString()}`);
    console.log(`  externalId: ${(sampleMarket as any).externalId || 'null'}`);
    
    console.log('\n匹配情况：');
    console.log(`  API总市场数: ${apiMarkets.length}`);
    console.log(`  包含符号 "${assetSymbol}" 的市场数: ${candidateMarkets.length}`);
    
    if (candidateMarkets.length > 0) {
      const withTimeInfo = candidateMarkets.filter(m => {
        return m.endDate || m.endDateISO || m.resolutionTime || 
               (m.events && m.events[0] && (m.events[0].endDate || m.events[0].endDateISO || m.events[0].resolutionTime));
      });
      console.log(`  有时间信息的市场数: ${withTimeInfo.length}`);
      
      // 找出时间最接近的市场
      let closestMarket: any = null;
      let minTimeDiff = Infinity;
      
      candidateMarkets.forEach((m: any) => {
        let marketEndTime: Date | null = null;
        if (m.endDate) marketEndTime = new Date(m.endDate);
        else if (m.endDateISO) marketEndTime = new Date(m.endDateISO);
        else if (m.resolutionTime) marketEndTime = new Date(m.resolutionTime);
        else if (m.events && m.events[0]) {
          const firstEvent = m.events[0];
          if (firstEvent.endDate) marketEndTime = new Date(firstEvent.endDate);
          else if (firstEvent.endDateISO) marketEndTime = new Date(firstEvent.endDateISO);
          else if (firstEvent.resolutionTime) marketEndTime = new Date(firstEvent.resolutionTime);
        }
        
        if (marketEndTime) {
          const timeDiff = Math.abs(marketEndTime.getTime() - localEndTime.getTime());
          if (timeDiff < minTimeDiff) {
            minTimeDiff = timeDiff;
            closestMarket = m;
          }
        }
      });
      
      if (closestMarket) {
        const closestEndTime = closestMarket.endDate ? new Date(closestMarket.endDate) :
                               closestMarket.endDateISO ? new Date(closestMarket.endDateISO) :
                               closestMarket.resolutionTime ? new Date(closestMarket.resolutionTime) : null;
        if (closestEndTime) {
          const closestTimeDiffSeconds = (closestEndTime.getTime() - localEndTime.getTime()) / 1000;
          console.log(`  最接近的市场时间差: ${closestTimeDiffSeconds.toFixed(2)} 秒`);
          console.log(`  最接近的市场标题: ${(closestMarket.question || closestMarket.slug || 'N/A').substring(0, 60)}...`);
          console.log(`  最接近的市场ID: ${closestMarket.id || closestMarket.conditionId || 'N/A'}`);
        }
      }
    }

    console.log('\n🔍 ===========================================');
    console.log('🔍 诊断完成');
    if (isMockMode) {
      console.log('   ⚠️ 本次诊断使用模拟数据模式');
    }
    console.log('🔍 ===========================================\n');

  } catch (error: any) {
    console.error('\n❌ 诊断过程中发生错误:', error);
    console.error('错误堆栈:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行诊断
diagnoseMatcher().catch(console.error);
