/**
 * 抽象采集引擎
 * 定义统一的采集流程：fetch() -> normalize() -> save()
 */

import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

/**
 * 采集结果接口
 */
export interface ScrapeResult {
  success: boolean;
  itemsCount: number;
  error?: string;
  data?: any;
}

/**
 * 抽象采集引擎基类
 */
export abstract class ScraperEngine {
  protected sourceName: string;

  constructor(sourceName: string) {
    this.sourceName = sourceName;
  }

  /**
   * 获取采集源记录（如果不存在则创建）
   */
  protected async getOrCreateDataSource() {
    return await prisma.data_sources.upsert({
      where: { sourceName: this.sourceName },
      update: {},
      create: {
        id: randomUUID(),
        updatedAt: new Date(),
        sourceName: this.sourceName,
        status: 'ACTIVE',
        multiplier: 1.0,
        itemsCount: 0,
      },
    });
  }

  /**
   * 更新采集源状态
   */
  protected async updateDataSourceStatus(
    status: 'ACTIVE' | 'INACTIVE' | 'ERROR',
    itemsCount?: number,
    errorMessage?: string
  ) {
    const updateData: any = {
      status,
      lastSyncTime: new Date(),
    };

    if (itemsCount !== undefined) {
      updateData.itemsCount = itemsCount;
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    } else if (status !== 'ERROR') {
      updateData.errorMessage = null;
    }

    await prisma.data_sources.update({
      where: { sourceName: this.sourceName },
      data: updateData,
    });
  }

  /**
   * 抽象方法：从数据源获取原始数据
   */
  protected abstract fetch(): Promise<any>;

  /**
   * 抽象方法：将原始数据标准化为统一格式
   */
  protected abstract normalize(rawData: any): any[];

  /**
   * 抽象方法：保存标准化后的数据到数据库
   */
  protected abstract save(normalizedData: any[]): Promise<number>;

  /**
   * 执行完整的采集流程
   */
  async execute(): Promise<ScrapeResult> {
    const overallStartTime = Date.now();
    console.log(`🚀 [DEBUG] ========== 采集器开始执行 ==========`);
    console.log(`🚀 [DEBUG] 采集源: ${this.sourceName}`);
    console.log(`🚀 [DEBUG] 开始时间: ${new Date().toISOString()}`);
    
    try {
      // 验证采集源是否存在
      console.log(`🔍 [DEBUG] 步骤 1/4: 验证采集源是否存在...`);
      const step1Start = Date.now();
      const dataSource = await this.getOrCreateDataSource();
      console.log(`✅ [DEBUG] 步骤 1/4 完成 (耗时: ${Date.now() - step1Start}ms)`);

      // 1. 获取原始数据
      console.log(`🔍 [DEBUG] 步骤 2/4: 开始连接外部 API 获取原始数据...`);
      const step2Start = Date.now();
      const rawData = await this.fetch();
      console.log(`✅ [DEBUG] 步骤 2/4 完成 (耗时: ${Date.now() - step2Start}ms)`);
      console.log(`📊 [DEBUG] API 返回数据量: ${Array.isArray(rawData) ? rawData.length : 0} 条`);

      // 2. 标准化数据
      console.log(`🔍 [DEBUG] 步骤 3/4: 开始标准化数据...`);
      const step3Start = Date.now();
      const normalizedData = this.normalize(rawData);
      console.log(`✅ [DEBUG] 步骤 3/4 完成 (耗时: ${Date.now() - step3Start}ms)`);
      console.log(`📊 [DEBUG] 标准化后数据量: ${normalizedData.length} 条`);

      // 3. 保存到数据库
      console.log(`🔍 [DEBUG] 步骤 4/4: 开始写入数据库...`);
      const step4Start = Date.now();
      const itemsCount = await this.save(normalizedData);
      console.log(`✅ [DEBUG] 步骤 4/4 完成 (耗时: ${Date.now() - step4Start}ms)`);
      console.log(`📊 [DEBUG] 成功保存: ${itemsCount} 条数据`);

      // 4. 更新采集源状态
      console.log(`🔍 [DEBUG] 更新采集源状态...`);
      await this.updateDataSourceStatus('ACTIVE', itemsCount);
      console.log(`✅ [DEBUG] 采集源状态已更新`);
      
      // 🔥 修复 write after end：所有日志和操作都在 return 之前完成
      const totalTime = Date.now() - overallStartTime;
      console.log(`🎉 [DEBUG] ========== 采集器执行完成 ==========`);
      console.log(`⏱️ [DEBUG] 总耗时: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}秒)`);

      // 🔥 确保在 return 之前完成所有操作
      const result = {
        success: true,
        itemsCount,
        data: normalizedData,
      };
      return result;
    } catch (error) {
      // 🔥 修复 write after end：所有日志和操作都在 return 之前完成
      console.error(`❌ [Scraper] ${this.sourceName} 采集失败:`);
      console.error(`   错误类型: ${error?.constructor?.name || 'Unknown'}`);
      console.error(`   错误消息: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`   错误堆栈: ${error instanceof Error ? error.stack : 'N/A'}`);
      console.error(`   完整错误对象:`, error);

      const errorMessage = error instanceof Error 
        ? `${error.name}: ${error.message}` 
        : String(error);

      // 🔥 更新为错误状态（必须在 return 之前完成）
      try {
        await this.updateDataSourceStatus(
          'ERROR',
          undefined,
          errorMessage.substring(0, 500) // 限制错误消息长度
        );
      } catch (updateError) {
        console.error(`❌ [Scraper] 更新错误状态失败:`, updateError);
      }

      // 🔥 确保在 return 之前完成所有操作
      const result = {
        success: false,
        itemsCount: 0,
        error: errorMessage,
      };
      return result;
    }
  }
}
