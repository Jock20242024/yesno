/**
 * 验证全量抓取配置脚本
 * 检查爬虫脚本是否配置为全量抓取
 * 
 * 运行方式: npx tsx scripts/verify-full-scrape.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

function verifyFullScrape() {
  console.log('🔍 检查爬虫脚本配置...');
  console.log('');
  
  const scraperPath = join(process.cwd(), 'lib/scrapers/polymarketAdapter.ts');
  const content = readFileSync(scraperPath, 'utf-8');
  
  // 检查是否有时间戳过滤
  const hasTimeFilter = /updatedAt.*gt|updatedAt.*gte|lastSyncedAt|since|after/i.test(content);
  const hasOffset = /offset.*[1-9]/.test(content); // 检查 offset 是否不为 0
  
  // 检查 limit 设置
  const limitMatch = content.match(/limit.*?(\d+)/);
  const limit = limitMatch ? parseInt(limitMatch[1]) : null;
  
  // 检查是否使用全量查询
  const hasClosedFalse = /closed.*false/i.test(content);
  const hasOffsetZero = /offset.*0/.test(content);
  
  console.log('📊 检查结果:');
  console.log(`  - 是否存在时间戳过滤: ${hasTimeFilter ? '❌ 是（有问题）' : '✅ 否（正确）'}`);
  console.log(`  - offset 是否大于 0: ${hasOffset ? '❌ 是（有问题）' : '✅ 否（正确）'}`);
  console.log(`  - limit 设置: ${limit ? `${limit}（${limit >= 500 ? '✅ 全量' : '⚠️ 可能不足'}）` : '❌ 未找到'}`);
  console.log(`  - 是否请求活跃市场（closed=false）: ${hasClosedFalse ? '✅ 是' : '❌ 否'}`);
  console.log(`  - offset 是否为 0: ${hasOffsetZero ? '✅ 是（从头开始）' : '❌ 否'}`);
  console.log('');
  
  if (hasTimeFilter) {
    console.log('❌ 发现时间戳过滤逻辑，这不是全量抓取！');
    return false;
  }
  
  if (hasOffset) {
    console.log('❌ offset 不为 0，可能不是从头开始抓取！');
    return false;
  }
  
  if (limit && limit < 500) {
    console.log('⚠️  limit 设置较小，可能无法抓取所有活跃市场！');
  }
  
  console.log('✅ 配置检查通过：脚本配置为全量抓取');
  return true;
}

verifyFullScrape();
