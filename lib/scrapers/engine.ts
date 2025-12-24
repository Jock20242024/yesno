/**
 * 抽象采集引擎
 * 定义统一的采集流程：fetch() -> normalize() -> save()
 */

import { prisma } from '@/lib/prisma';

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
    return await prisma.dataSource.upsert({
      where: { sourceName: this.sourceName },
      update: {},
      create: {
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

    await prisma.dataSource.update({
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
    try {
      console.log(`🚀 [Scraper] 开始采集: ${this.sourceName}`);
      console.log(`📋 [Scraper] 采集源标识符: ${this.sourceName}`);

      // 验证采集源是否存在
      const dataSource = await this.getOrCreateDataSource();
      console.log(`✅ [Scraper] 采集源记录验证: ID=${dataSource.id}, Status=${dataSource.status}`);

      // 1. 获取原始数据
      console.log(`📡 [Scraper] ${this.sourceName} 开始获取原始数据...`);
      const rawData = await this.fetch();
      console.log(`✅ [Scraper] ${this.sourceName} 获取数据成功，原始数据量: ${Array.isArray(rawData) ? rawData.length : 'N/A'}`);

      // 2. 标准化数据
      console.log(`🔄 [Scraper] ${this.sourceName} 开始标准化数据...`);
      const normalizedData = this.normalize(rawData);
      console.log(`✅ [Scraper] ${this.sourceName} 标准化完成，共 ${normalizedData.length} 条`);

      // 3. 保存到数据库
      console.log(`💾 [Scraper] ${this.sourceName} 开始保存到数据库...`);
      const itemsCount = await this.save(normalizedData);
      console.log(`✅ [Scraper] ${this.sourceName} 保存完成，共 ${itemsCount} 条`);

      // 4. 更新采集源状态
      await this.updateDataSourceStatus('ACTIVE', itemsCount);
      console.log(`✅ [Scraper] ${this.sourceName} 采集流程完成，状态已更新`);

      return {
        success: true,
        itemsCount,
        data: normalizedData,
      };
    } catch (error) {
      // 详细错误日志
      console.error(`❌ [Scraper] ${this.sourceName} 采集失败:`);
      console.error(`   错误类型: ${error?.constructor?.name || 'Unknown'}`);
      console.error(`   错误消息: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`   错误堆栈: ${error instanceof Error ? error.stack : 'N/A'}`);
      console.error(`   完整错误对象:`, error);

      const errorMessage = error instanceof Error 
        ? `${error.name}: ${error.message}` 
        : String(error);

      // 更新为错误状态
      try {
        await this.updateDataSourceStatus(
          'ERROR',
          undefined,
          errorMessage.substring(0, 500) // 限制错误消息长度
        );
        console.log(`✅ [Scraper] ${this.sourceName} 错误状态已更新到数据库`);
      } catch (updateError) {
        console.error(`❌ [Scraper] 更新错误状态失败:`, updateError);
      }

      return {
        success: false,
        itemsCount: 0,
        error: errorMessage,
      };
    }
  }
}
