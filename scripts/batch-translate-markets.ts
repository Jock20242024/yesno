/**
 * 批量翻译历史市场数据脚本
 * 
 * 功能：
 * - 扫描所有 titleZh 为空的 Polymarket 市场
 * - 批量调用 AI 翻译服务进行翻译
 * - 将翻译结果保存到数据库
 * 
 * 运行方式：
 * - 单次运行: npx tsx scripts/batch-translate-markets.ts
 * - 带参数: npx tsx scripts/batch-translate-markets.ts --batch-size=50 --delay=1000
 * 
 * 参数说明：
 * - --batch-size: 每批处理的记录数（默认：50）
 * - --delay: 每批之间的延迟（毫秒，默认：1000，避免 API 速率限制）
 * - --limit: 限制处理的总记录数（默认：100，只翻译前100条）
 * - --all 或 --all-markets: 翻译所有市场（包括未审核的），默认只翻译已审核上架的市场
 * - --published-only: 只翻译已审核上架的市场（默认行为）
 * - --no-limit: 不限制数量，翻译所有符合条件的市场
 * 
 * 注意：
 * - 确保 .env.local 文件存在并包含 DATABASE_URL 和 OPENAI_API_KEY（或 ANTHROPIC_API_KEY）
 * - 如果数据库连接失败，请检查网络连接和数据库服务器状态
 */

// 🔥 加载环境变量（必须在导入 prisma 之前）
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载 .env.local 文件
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// 如果 .env.local 中没有找到，尝试加载 .env
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

import { prisma } from '@/lib/prisma';
import { translateText } from '@/lib/scrapers/translateService';

interface ScriptOptions {
  batchSize: number;
  delay: number;
  limit?: number;
  onlyPublished?: boolean; // 只翻译已审核上架的市场
}

/**
 * 解析命令行参数
 */
function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {
    batchSize: 50,
    delay: 1000,
    limit: 100, // 🔥 默认只翻译前100条
    onlyPublished: true, // 🔥 默认只翻译已审核上架的市场
  };

  args.forEach(arg => {
    if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1], 10) || 50;
    } else if (arg.startsWith('--delay=')) {
      options.delay = parseInt(arg.split('=')[1], 10) || 1000;
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--all' || arg === '--all-markets') {
      // 翻译所有市场（包括未审核的）
      options.onlyPublished = false;
    } else if (arg === '--published-only' || arg === '--only-published') {
      // 只翻译已审核上架的市场（默认）
      options.onlyPublished = true;
    } else if (arg === '--no-limit') {
      // 不限制数量
      options.limit = undefined;
    }
  });

  return options;
}

/**
 * 测试数据库连接
 */
async function testDatabaseConnection(): Promise<boolean> {
  try {
    console.log(`🔍 [Batch Translate] 检查数据库连接...`);
    await prisma.$connect();
    // 尝试执行一个简单查询
    await prisma.$queryRaw`SELECT 1`;
    console.log(`✅ [Batch Translate] 数据库连接成功`);
    return true;
  } catch (error) {
    console.error(`❌ [Batch Translate] 数据库连接失败:`);
    console.error(`   错误: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`\n💡 解决方案:`);
    console.error(`   1. 检查 .env.local 文件中的 DATABASE_URL 是否正确`);
    console.error(`   2. 确认数据库服务器是否可访问`);
    console.error(`   3. 检查网络连接是否正常`);
    if (process.env.DATABASE_URL) {
      const dbUrl = process.env.DATABASE_URL;
      const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@'); // 隐藏密码
      console.error(`   当前 DATABASE_URL: ${maskedUrl}`);
    } else {
      console.error(`   ⚠️  DATABASE_URL 环境变量未设置`);
    }
    return false;
  }
}

/**
 * 批量翻译市场
 */
async function batchTranslateMarkets(options: ScriptOptions) {
  try {
    console.log(`\n🔄 [Batch Translate] ========== 开始批量翻译历史市场 ==========`);
    console.log(`⏰ [Batch Translate] 执行时间: ${new Date().toISOString()}`);
    console.log(`📋 [Batch Translate] 配置:`, {
      batchSize: options.batchSize,
      delay: `${options.delay}ms`,
      limit: options.limit || '不限制',
      onlyPublished: options.onlyPublished ? '只翻译已审核上架的市场' : '翻译所有市场',
    });

    // 0. 测试数据库连接
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
      console.error(`\n❌ [Batch Translate] 无法连接到数据库，脚本终止`);
      process.exit(1);
    }

    // 1. 查询需要翻译的市场（titleZh 为空的 Polymarket 市场）
    console.log(`\n🔍 [Batch Translate] 查询需要翻译的市场...`);
    const whereClause: any = {
      source: 'POLYMARKET',
      OR: [
        { titleZh: null },
        { titleZh: '' },
      ],
    };

    // 🔥 如果只翻译已审核上架的市场，添加过滤条件
    if (options.onlyPublished) {
      whereClause.status = 'OPEN'; // 只翻译已开放的市场
      whereClause.reviewStatus = 'PUBLISHED'; // 只翻译已发布的市场（ReviewStatus 枚举值：PENDING, PUBLISHED, REJECTED）
      console.log(`   📌 过滤条件: 只翻译已审核上架的市场 (status='OPEN' AND reviewStatus='PUBLISHED')`);
    } else {
      console.log(`   📌 过滤条件: 翻译所有市场（包括未审核的）`);
    }

    const totalCount = await prisma.markets.count({ where: whereClause });
    console.log(`📊 [Batch Translate] 找到 ${totalCount} 个需要翻译的市场`);

    if (totalCount === 0) {
      console.log(`✅ [Batch Translate] 没有需要翻译的市场，任务完成`);
      return;
    }

    // 2. 分批处理
    const limit = options.limit || totalCount;
    const actualLimit = Math.min(limit, totalCount);
    let processedCount = 0;
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    console.log(`\n🚀 [Batch Translate] 开始批量翻译（最多处理 ${actualLimit} 条）...`);

    while (processedCount < actualLimit) {
      const batchSize = Math.min(options.batchSize, actualLimit - processedCount);
      const skip = processedCount;

      // 查询当前批次
      const markets = await prisma.markets.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          description: true,
          titleZh: true,
          descriptionZh: true,
          status: true, // 🔥 添加 status 用于调试
          reviewStatus: true, // 🔥 添加 reviewStatus 用于调试
        },
        take: batchSize,
        skip: skip,
        orderBy: {
          totalVolume: 'desc', // 🔥 优先处理交易量大的市场（更重要的市场）
        },
      });

      if (markets.length === 0) {
        console.log(`\n✅ [Batch Translate] 所有市场已处理完成`);
        break;
      }

      console.log(`\n📦 [Batch Translate] 处理批次 ${Math.floor(processedCount / options.batchSize) + 1} (${markets.length} 条)`);

      // 处理当前批次
      for (const market of markets) {
        try {
          // 跳过没有标题的市场
          if (!market.title || !market.title.trim()) {
            console.warn(`⚠️ [Batch Translate] 跳过无标题市场: ${market.id}`);
            skipCount++;
            processedCount++;
            continue;
          }

          // 🔥 只翻译标题，不翻译描述（节省 API 调用）
          let titleZh: string | null = null;

          console.log(`🌐 [Batch Translate] 翻译市场标题: ${market.title.substring(0, 50)}...`);

          try {
            titleZh = await translateText(market.title, 'zh');
            if (titleZh && titleZh.trim()) {
              console.log(`  ✅ 标题翻译成功: ${titleZh.substring(0, 50)}...`);
            } else {
              console.warn(`  ⚠️ 标题翻译返回空，可能 API Key 未配置`);
              titleZh = null;
            }
          } catch (error) {
            console.error(`  ❌ 标题翻译失败:`, error instanceof Error ? error.message : String(error));
            titleZh = null;
          }

          // 更新数据库（只更新 titleZh，不更新 descriptionZh）
          if (titleZh) {
            await prisma.markets.update({
              where: { id: market.id },
              data: {
                titleZh: titleZh,
                updatedAt: new Date(),
              },
            });
            successCount++;
            console.log(`  ✅ 数据库更新成功`);
          } else {
            failCount++;
            console.warn(`  ⚠️ 跳过数据库更新（翻译失败）`);
          }

          processedCount++;

          // 添加小延迟，避免 API 速率限制
          if (processedCount < actualLimit) {
            await new Promise(resolve => setTimeout(resolve, 100)); // 每条记录之间延迟 100ms
          }
        } catch (error) {
          console.error(`❌ [Batch Translate] 处理市场失败 (ID: ${market.id}):`, error);
          failCount++;
          processedCount++;
        }
      }

      // 批次之间的延迟
      if (processedCount < actualLimit) {
        console.log(`⏳ [Batch Translate] 等待 ${options.delay}ms 后处理下一批...`);
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }
    }

    // 3. 输出统计结果
    console.log(`\n📊 [Batch Translate] ========== 批量翻译完成 ==========`);
    console.log(`✅ 成功: ${successCount} 条`);
    console.log(`❌ 失败: ${failCount} 条`);
    console.log(`⏭️ 跳过: ${skipCount} 条`);
    console.log(`📝 总计: ${processedCount} 条`);
    console.log(`⏰ 完成时间: ${new Date().toISOString()}`);

    if (successCount > 0) {
      console.log(`\n🎉 [Batch Translate] 批量翻译成功完成！`);
    } else {
      console.log(`\n⚠️ [Batch Translate] 没有成功翻译任何市场，请检查 API Key 配置`);
    }
  } catch (error) {
    console.error(`\n❌ [Batch Translate] 批量翻译失败:`, error);
    console.error(`错误类型: ${error instanceof Error ? error.constructor.name : typeof error}`);
    console.error(`错误消息: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`错误堆栈: ${error instanceof Error ? error.stack : 'N/A'}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行脚本
const options = parseArgs();
batchTranslateMarkets(options).catch(error => {
  console.error('❌ [Batch Translate] 脚本执行失败:', error);
  process.exit(1);
});

